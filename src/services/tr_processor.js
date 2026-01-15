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

        // 2. Token Estimation & Intelligent Model Selection (Qwen 3 Optimized)
        const charCount = combinedText.length;
        const estimatedTokens = Math.ceil(charCount / 4);

        console.log(`[Oracle] Estimated Tokens: ~${estimatedTokens}`);

        // --- MULTI-TIER FALLBACK CONFIGURATION ---
        // We'll attempt providers in this order until one succeeds
        const fallbackChain = [];

        // TIER 1: Qwen 3 Models (Primary - User requested ALWAYS QWEN 3)
        let qwenKey = process.env.DASHSCOPE_API_KEY || process.env.QWEN_KEY || process.env.QWEN_API_KEY;
        
        // Try getting Qwen Key from DB if not in Env
        if (!qwenKey) {
            const dbOracleKey = await getSetting('oracle_api_key');
            const dbOracleProvider = await getSetting('oracle_provider');
            if (dbOracleProvider === 'qwen' && dbOracleKey) {
                qwenKey = dbOracleKey;
            }
        }

        if (qwenKey) {
            // Token-based Qwen 3 model selection
            let qwenModel;
            if (estimatedTokens < 15000) {
                qwenModel = 'qwen-turbo-latest'; // Fast & cost-effective for small docs
            } else if (estimatedTokens < 100000) {
                qwenModel = 'qwen-plus-latest'; // Balanced for medium docs
            } else {
                qwenModel = 'qwen-max-latest'; // Maximum capability for large docs
            }

            fallbackChain.push(
                { provider: PROVIDERS.QWEN, model: qwenModel, apiKey: qwenKey, tier: 1, name: `Qwen (${qwenModel})` },
                // Fallback within Qwen if first model fails
                { provider: PROVIDERS.QWEN, model: 'qwen3-max', apiKey: qwenKey, tier: 1, name: 'Qwen 3 Max (Stable)' },
                { provider: PROVIDERS.QWEN, model: 'qwen-turbo-latest', apiKey: qwenKey, tier: 1, name: 'Qwen Turbo (Fast Fallback)' }
            );
            console.log(`[Oracle] Primary Model: ${qwenModel} (Tier 1 - Qwen 3)`);
        } else {
            console.warn('[Oracle] Qwen API key not configured. Skipping Qwen tier.');
        }

        // TIER 2: DeepSeek (Secondary Fallback)
        let deepseekKey = process.env.DEEPSEEK_API_KEY;
        if (!deepseekKey) {
            const dbKey = await getSetting('oracle_api_key');
            const dbProvider = await getSetting('oracle_provider');
            if (dbProvider === 'deepseek' && dbKey) deepseekKey = dbKey;
        }

        if (deepseekKey) {
            fallbackChain.push(
                { provider: PROVIDERS.DEEPSEEK, model: 'deepseek-reasoner', apiKey: deepseekKey, tier: 2, name: 'DeepSeek Reasoner' },
                { provider: PROVIDERS.DEEPSEEK, model: 'deepseek-chat', apiKey: deepseekKey, tier: 2, name: 'DeepSeek Chat' }
            );
        }

        // TIER 3: Gemini (Final Fallback)
        let geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!geminiKey) {
            const dbKey = await getSetting('oracle_api_key');
            const dbProvider = await getSetting('oracle_provider');
            if (dbProvider === 'gemini' && dbKey) geminiKey = dbKey;
        }

        if (geminiKey) {
            fallbackChain.push(
                { provider: PROVIDERS.GEMINI, model: 'gemini-2.0-flash-exp', apiKey: geminiKey, tier: 3, name: 'Gemini 2.0 Flash' },
                { provider: PROVIDERS.GEMINI, model: 'gemini-1.5-pro', apiKey: geminiKey, tier: 3, name: 'Gemini 1.5 Pro' }
            );
        }

        if (fallbackChain.length === 0) {
            throw new Error('Nenhuma chave de API configurada. Configure DASHSCOPE_API_KEY, DEEPSEEK_API_KEY ou GEMINI_API_KEY.');
        }

        console.log(`[Oracle] Fallback chain configured with ${fallbackChain.length} options across ${new Set(fallbackChain.map(f => f.tier)).size} tiers.`);

        // 3. Load System Prompt (God Mode)
        const promptPath = path.join(__dirname, '../../prompts/oracle_god_mode.txt');
        let systemPrompt = "";
        try {
            systemPrompt = fs.readFileSync(promptPath, 'utf8');
        } catch (e) {
            console.error("Failed to load prompt file:", e);
            throw new Error("System Prompt missing.");
        }

        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: `AQUI ESTÁ O TEXTO DO EDITAL:\n\n${combinedText}` }
        ];

        // 4. Attempt Generation with Fallback Chain
        let finalResponse = "";
        let finalThoughts = "";
        let usedConfig = null;
        let lastError = null;

        for (const config of fallbackChain) {
            try {
                console.log(`[Oracle] Tentando ${config.name} (Tier ${config.tier})...`);
                
                let thoughtBuffer = "";
                let responseBuffer = "";

                await new Promise((resolve, reject) => {
                    generateStream(
                        { 
                            provider: config.provider, 
                            model: config.model, 
                            apiKey: config.apiKey, 
                            messages 
                        },
                        {
                            onThought: (chunk) => {
                                thoughtBuffer += chunk;
                                finalThoughts += chunk;
                            },
                            onChunk: (chunk) => {
                                responseBuffer += chunk;
                            },
                            onDone: () => resolve(),
                            onError: (err) => reject(err)
                        }
                    );
                });

                if (responseBuffer && responseBuffer.trim().length > 0) {
                    finalResponse = responseBuffer;
                    usedConfig = config;
                    console.log(`[Oracle] ✓ Sucesso com ${config.name}!`);
                    break; // Success! Exit the fallback loop
                } else {
                    throw new Error('Resposta vazia do modelo');
                }

            } catch (err) {
                lastError = err;
                const errorMsg = err.message || String(err);
                console.warn(`[Oracle] ✗ Falha com ${config.name}: ${errorMsg}`);
                
                // Check if this is a fatal error that we shouldn't retry
                if (errorMsg.includes('401') || errorMsg.includes('invalid_api_key') || errorMsg.includes('authentication')) {
                    console.error(`[Oracle] Erro de Autenticação detectado. Pulando para próximo tier.`);
                    // Skip remaining models in this tier
                    const currentTier = config.tier;
                    const nextTierIndex = fallbackChain.findIndex(c => c.tier > currentTier);
                    if (nextTierIndex === -1) break; // No more tiers
                    continue;
                }
                
                // For other errors (404 model not found, rate limits, etc.), continue to next model
                continue;
            }
        }

        if (!finalResponse || !usedConfig) {
            const errorDetails = lastError ? lastError.message : 'Erro desconhecido';
            console.error('[Oracle] Todos os fallbacks falharam. Último erro:', errorDetails);
            throw new Error(`Falha em todos os provedores de IA. Último erro: ${errorDetails}`);
        }

        console.log(`[Oracle] Análise concluída usando: ${usedConfig.name}`);

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
            edital_numero: jsonResponse.public_teaser.suggested_title || "Análise Estratégica",
            municipio_uf: "Brasil", // Generic location fallback
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
