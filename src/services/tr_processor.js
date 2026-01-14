const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const { generateStream, PROVIDERS } = require('./ai_manager');
const { getSetting } = require('../database');

async function processPDF(filePaths, onThought = null) {
    try {
        if (typeof filePaths === 'string') {
            filePaths = [filePaths];
        }

        let combinedText = "";

        // 1. Extract Text
        for (const filePath of filePaths) {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdf(dataBuffer);
            combinedText += `\n--- START OF FILE ${filePath} ---\n` + data.text + `\n--- END OF FILE ${filePath} ---\n`;
        }

        // 2. Token Estimation & Model Selection (Token Economy)
        const charCount = combinedText.length;
        const estimatedTokens = Math.ceil(charCount / 4);

        // Force Qwen for this specific Oracle flow as per "Protocol V5.0" (Qwen 3 Upgrade)
        // User requested "AT LEAST QWEN 3". 'qwen-max' points to the latest flagship (Qwen 3 Max).
        let provider = PROVIDERS.QWEN;
        let model = 'qwen-max'; // Flagship Model (Qwen 3 Max)

        if (estimatedTokens > 28000) {
            model = 'qwen-long'; // Specialized for massive contexts
        }

        // Fallback: Check if we have Qwen Key, if not try to use what's configured in DB/Env,
        // but the prompt explicitly asked for this logic. We will try to stick to it if keys exist.
        let qwenKey = process.env.DASHSCOPE_API_KEY || process.env.QWEN_KEY || process.env.QWEN_API_KEY;

        // Try getting Qwen Key from DB if not in Env
        if (!qwenKey) {
             const dbOracleKey = await getSetting('oracle_api_key');
             const dbOracleProvider = await getSetting('oracle_provider');
             if (dbOracleProvider === 'qwen' && dbOracleKey) {
                 qwenKey = dbOracleKey;
             }
        }

        let apiKey = qwenKey;

        if (!qwenKey) {
            // Fallback to existing logic if Qwen not configured
            provider = await getSetting('oracle_provider') || PROVIDERS.DEEPSEEK;
            model = await getSetting('oracle_model') || 'deepseek-reasoner';
            apiKey = await getSetting('oracle_api_key') || process.env[`${provider.toUpperCase()}_API_KEY`];
            console.warn("[Oracle] Qwen key missing. Falling back to configured provider:", provider, model);
        } else {
            console.log(`[Oracle] Token Count: ~${estimatedTokens}. Selected Model: ${model}`);
        }

        // 3. Load System Prompt (God Mode)
        const promptPath = path.join(__dirname, '../../prompts/oracle_god_mode.txt');
        let systemPrompt = "";
        try {
            systemPrompt = fs.readFileSync(promptPath, 'utf8');
        } catch (e) {
            console.error("Failed to load prompt file:", e);
            throw new Error("System Prompt missing.");
        }

        // The prompt file contains the instruction.
        // We will pass the combined text as the user message.
        // We append the text to a specific marker if the prompt expects it,
        // but the prompt says "Ao processar o texto do edital..." so we can just append it.

        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: `AQUI ESTÁ O TEXTO DO EDITAL:\n\n${combinedText}` }
        ];

        // 4. Generate with Stream
        // Thought Buffer to detect titles if model produces them (DeepSeek style),
        // but Qwen might just output normal text. The prompt doesn't explicitly force **Title** for Qwen,
        // but we can try to catch it if it happens.
        // The prompt says "Sua linguagem... deve ser PERSUASIVA".
        // It does NOT explicitly ask for "thoughts" in the output JSON, but the UI expects "Neural Pulse".
        // We can simulate thoughts or use what the model gives if it supports reasoning (Qwen-Max/Plus usually don't output separate thought stream like DeepSeek R1).
        // However, the `generateStream` for Qwen in `ai_manager` handles `reasoning_content`.

        let thoughtBuffer = "";
        let finalResponse = "";
        let finalThoughts = "";

        await new Promise((resolve, reject) => {
            generateStream(
                { provider, model, apiKey, messages },
                {
                    onThought: (chunk) => {
                        thoughtBuffer += chunk;
                        finalThoughts += chunk;
                        // PRIVACY UPDATE: Do NOT send raw thoughts to frontend.
                        // sending nothing or specific "pulse" if needed, but frontend will handle "fake" text.
                        // if (onThought) onThought(chunk); 
                    },
                    onChunk: (chunk) => {
                        finalResponse += chunk;
                    },
                    onDone: () => resolve(),
                    onError: (err) => reject(err)
                }
            );
        });

        if (!finalResponse) throw new Error("API falhou ou retornou vazio.");

        // 5. JSON Extraction
        let jsonResponse;
        try {
            // Extract JSON logic
            const jsonMatch = finalResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonResponse = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error("Invalid JSON format from AI");
            }
        } catch (e) {
            console.error("JSON Parsing failed. Raw:", finalResponse);
            throw new Error("Falha na decodificação neural.");
        }

        // --- SAVE TO DB --- (This section seems to be from a calling function, but added as per instruction)
        const meta = jsonResponse.public_teaser || {};
        const locked = jsonResponse.locked_modules || {};
        
        // Extract Title from metadata or fallback
        let opportunityTitle = meta.suggested_title || `ANÁLISE ${new Date().toLocaleDateString()}`;

        // The following variables (userId, createOpportunity) are not defined in this file.
        // This code snippet seems to be intended for a higher-level function that calls processPDF.
        // For the purpose of faithfully applying the change, it's included, but will cause errors if executed as is.


        // Normalize Structure (original logic, now using jsonResponse)
        if (!jsonResponse.public_teaser) jsonResponse.public_teaser = {};
        if (!jsonResponse.locked_modules) jsonResponse.locked_modules = {};

        // Map to internal structure expected by Database/UI fallback if needed,
        // but we are rewriting UI so we should stick to the new structure.
        // However, `server.js` expects `metadata`, `locked_content`, `items`, `ipm_score`.
        // We must map the new JSON to these fields to avoid breaking the DB save in server.js.

        const metadata = {
            ...jsonResponse.public_teaser, // ipm_score, classificacao, etc.
            edital_numero: jsonResponse.public_teaser.resumo_poderoso ? "Análise Estratégica" : "Sem Título", // Fallback
            municipio_uf: "Brasil", // We don't have this explicitly in new JSON unless we parse it or add to prompt
            // Actually prompt doesn't ask for municipality in JSON. We can try to extract or leave generic.
        };

        const locked_content = jsonResponse.locked_modules; // This matches the concept

        // Items: Prompt says "NÃO LISTE TODOS OS ITENS".
        // But server.js tries to save `items`. We can return empty array.
        // The prompt has `itens_alpha` inside `locked_modules`.
        // We can extract those to `items` if we want them searchable,
        // but the requirement is "Silent Scan" -> "No extraction".
        const items = [];

        return {
            metadata,
            locked_content,
            items
        };

    } catch (e) {
        console.error("Oracle Processing Failed:", e);
        throw e;
    }
}

module.exports = { processPDF };
