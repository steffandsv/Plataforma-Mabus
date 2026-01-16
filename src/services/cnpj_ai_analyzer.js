const { generateText } = require('./ai_manager');

/**
 * CNPJ AI Analyzer
 * Usa IA (DeepSeek) para analisar dados do CNPJ e gerar preferências automaticamente
 */

// Mapeamento de estados fronteiriços do Brasil
const ESTADOS_FRONTEIRAS = {
    'AC': ['AM', 'RO'],
    'AL': ['PE', 'SE', 'BA'],
    'AP': ['PA'],
    'AM': ['RR', 'PA', 'MT', 'RO', 'AC'],
    'BA': ['SE', 'AL', 'PE', 'PI', 'TO', 'GO', 'MG', 'ES'],
    'CE': ['RN', 'PB', 'PE', 'PI'],
    'DF': ['GO', 'MG'],
    'ES': ['BA', 'MG', 'RJ'],
    'GO': ['TO', 'BA', 'MG', 'MS', 'MT', 'DF'],
    'MA': ['PA', 'TO', 'PI'],
    'MT': ['RO', 'AM', 'PA', 'TO', 'GO', 'MS'],
    'MS': ['GO', 'MG', 'SP', 'PR', 'MT'],
    'MG': ['BA', 'ES', 'RJ', 'SP', 'MS', 'GO', 'DF'],
    'PA': ['AP', 'RR', 'AM', 'MT', 'TO', 'MA'],
    'PB': ['RN', 'CE', 'PE'],
    'PR': ['SP', 'MS', 'SC'],
    'PE': ['PB', 'CE', 'PI', 'BA', 'AL'],
    'PI': ['CE', 'MA', 'TO', 'BA', 'PE'],
    'RJ': ['ES', 'MG', 'SP'],
    'RN': ['PB', 'CE'],
    'RS': ['SC'],
    'RO': ['AC', 'AM', 'MT'],
    'RR': ['AM', 'PA'],
    'SC': ['PR', 'RS'],
    'SP': ['MG', 'RJ', 'PR', 'MS'],
    'SE': ['AL', 'BA'],
    'TO': ['MA', 'PI', 'BA', 'GO', 'MT', 'PA']
};

/**
 * Analisa CNPJ com IA e gera preferências automaticamente
 * @param {Object} cnpjData - Dados do CNPJ (da consulta OpenCNPJ)
 * @param {string} apiKey - API key para DeepSeek
 * @returns {Promise<Object>} Preferências geradas
 */
async function analyzeCNPJForPreferences(cnpjData, apiKey) {
    try {
        console.log('[CNPJ AI Analyzer] Iniciando análise com IA...');

        // Preparar dados para a IA
        const cnaePrincipal = cnpjData.cnaePrincipal || {};
        const cnaesSecundarios = cnpjData.cnaesSecundarios || [];
        const uf = cnpjData.endereco?.uf || '';
        const municipio = cnpjData.endereco?.municipio || '';
        const porte = cnpjData.porteEmpresa || 'NÃO INFORMADO';

        // Construir prompt otimizado
        const prompt = `Você é um especialista em licitações públicas brasileiras. Analise os dados desta empresa e gere sugestões de preferências para busca de licitações.

DADOS DA EMPRESA:
- CNPJ: ${cnpjData.cnpj}
- Razão Social: ${cnpjData.razaoSocial}
- CNAE Principal: ${cnaePrincipal.codigo} - ${cnaePrincipal.descricao}
${cnaesSecundarios.length > 0 ? `- CNAEs Secundários:\n${cnaesSecundarios.map(c => `  • ${c.codigo} - ${c.descricao}`).join('\n')}` : ''}
- Localização: ${municipio}/${uf}
- Porte: ${porte}

TAREFA:
1. PALAVRAS-CHAVE: Gere 50-100 palavras-chave (substantivos e termos técnicos) que aparecem frequentemente em editais de licitação relacionados aos CNAEs desta empresa. Seja ESPECÍFICO e DIVERSO. Inclua:
   - Produtos/serviços do ramo
   - Equipamentos típicos
   - Materiais relacionados
   - Termos técnicos da área
   - Sinônimos e variações

2. MODALIDADES: Identifique as modalidades de licitação mais comuns para este tipo de empresa (ex: Pregão, Concorrência, Dispensa, etc)

3. VALORES: Sugira valores mínimo e máximo adequados baseando-se no porte:
   - MEI: até R$ 100.000
   - MICROEMPRESA: até R$ 500.000  
   - PEQUENO PORTE: até R$ 2.000.000
   - DEMAIS: sem limite superior

4. RACIOCÍNIO: Explique BREVEMENTE (2-3 linhas) por que estas sugestões fazem sentido para esta empresa.

IMPORTANTE: Retorne APENAS um JSON válido, sem texto adicional, no formato:
{
  "keywords": ["palavra1", "palavra2", ...],
  "modalidades": ["Pregão", ...],
  "min_value": 0,
  "max_value": 500000,
  "reasoning": "Esta empresa de [ramo] tipicamente participa de licitações para..."
}`;

        // Chamar IA (DeepSeek)
        const aiResponse = await generateText({
            provider: 'deepseek',
            model: 'deepseek-chat',
            apiKey: apiKey,
            messages: [
                { role: 'system', content: 'Você é um assistente que retorna apenas JSON válido, sem markdown ou texto adicional.' },
                { role: 'user', content: prompt }
            ]
        });

        console.log('[CNPJ AI Analyzer] Resposta da IA recebida');

        // Parse JSON (remover markdown se houver)
        let jsonStr = aiResponse.trim();
        if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.replace(/```json\n?/, '').replace(/\n?```$/, '');
        } else if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/```\n?/, '').replace(/\n?```$/, '');
        }

        const aiPreferences = JSON.parse(jsonStr);

        // Adicionar UFs (estado + fronteiras)
        const preferredUFs = [uf];
        if (ESTADOS_FRONTEIRAS[uf]) {
            preferredUFs.push(...ESTADOS_FRONTEIRAS[uf]);
        }

        // Resultado final
        const result = {
            keywords: aiPreferences.keywords || [],
            preferred_ufs: [...new Set(preferredUFs)], // Remove duplicatas
            preferred_municipios: [municipio],
            preferred_modalidades: aiPreferences.modalidades || ['Pregão'],
            min_value: aiPreferences.min_value || 0,
            max_value: aiPreferences.max_value || 999999999,
            reasoning: aiPreferences.reasoning || 'Preferências baseadas nos CNAEs da empresa.',
            // Configurações de visualização (deixar padrão)
            default_view_mode: 'story',
            cards_per_row: 3,
            // Esfera e poder (deixar vazio para não filtrar)
            preferred_esferas: [],
            preferred_poderes: []
        };

        console.log(`[CNPJ AI Analyzer] ✅ Análise concluída - ${result.keywords.length} keywords geradas`);

        return result;

    } catch (erro) {
        console.error('[CNPJ AI Analyzer] Erro:', erro);

        // Fallback: Retornar preferências básicas sem IA
        console.log('[CNPJ AI Analyzer] ⚠️ Usando fallback sem IA');

        const uf = cnpjData.endereco?.uf || 'SP';
        const municipio = cnpjData.endereco?.municipio || '';
        const preferredUFs = [uf];
        if (ESTADOS_FRONTEIRAS[uf]) {
            preferredUFs.push(...ESTADOS_FRONTEIRAS[uf]);
        }

        return {
            keywords: [],
            preferred_ufs: [...new Set(preferredUFs)],
            preferred_municipios: municipio ? [municipio] : [],
            preferred_modalidades: ['Pregão'],
            min_value: 0,
            max_value: 999999999,
            reasoning: 'Não foi possível gerar sugestões com IA. Configure manualmente as palavras-chave.',
            default_view_mode: 'story',
            cards_per_row: 3,
            preferred_esferas: [],
            preferred_poderes: []
        };
    }
}

module.exports = {
    analyzeCNPJForPreferences,
    ESTADOS_FRONTEIRAS
};
