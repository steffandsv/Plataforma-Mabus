const axios = require('axios');

/**
 * Cliente HTTP para API do PNCP (Portal Nacional de Contratações Públicas)
 * 
 * Endpoint correto descoberto via testes: /api/consulta/v1/contratacoes/publicacao
 * Requer parâmetro obrigatório: codigoModalidadeContratacao
 * 
 * Rate limit: 5 requisições/segundo
 */
class PNCPClient {
    constructor() {
        this.baseURL = 'https://pncp.gov.br/api/consulta/v1';
        this.lastRequestTime = 0;
        this.minRequestInterval = 250; // 4 req/s para segurança (limite é 5/s)
    }

    /**
     * Controle de rate limiting manual
     */
    async rateLimit() {
        const now = Date.now();
        const elapsed = now - this.lastRequestTime;
        if (elapsed < this.minRequestInterval) {
            await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - elapsed));
        }
        this.lastRequestTime = Date.now();
    }

    /**
     * Buscar licitações com paginação
     * IMPORTANTE: API requer codigoModalidadeContratacao!
     * 
     * @param {Object} params - { dataInicial, dataFinal, codigoModalidadeContratacao, pagina, tamanhoPagina }
     * @returns {Promise<Object>} { success, data, totalRegistros, totalPaginas, numeroPagina }
     */
    async buscarLicitacoes(params = {}) {
        await this.rateLimit();

        // Modalidade padrão: 8 (Dispensa) se não especificado
        // Outras modalidades comuns: 1=Pregão Eletrônico, 8=Dispensa
        const modalidade = params.codigoModalidadeContratacao || 8;

        const queryParams = {
            dataInicial: params.dataInicial, // formato: YYYYMMDD
            dataFinal: params.dataFinal,      // formato: YYYYMMDD
            codigoModalidadeContratacao: modalidade, // OBRIGATÓRIO!
            pagina: params.pagina || 1,
            tamanhoPagina: Math.min(Math.max(params.tamanhoPagina || 50, 10), 50) // min 10, max 50
        };

        if (params.cnpjOrgao) {
            queryParams.cnpjOrgao = params.cnpjOrgao;
        }

        try {
            console.log(`[PNCP Client] Buscando licitações: ${params.dataInicial} a ${params.dataFinal}, modalidade ${modalidade}, página ${queryParams.pagina}`);

            const response = await axios.get(`${this.baseURL}/contratacoes/publicacao`, {
                params: queryParams,
                timeout: 30000,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mabus-Platform/1.0'
                }
            });

            // Status 204 = Sem conteúdo (nenhuma licitação encontrada)
            if (response.status === 204) {
                console.log(`[PNCP Client] ℹ️ Nenhuma licitação encontrada`);
                return {
                    success: true,
                    data: [],
                    totalRegistros: 0,
                    totalPaginas: 0,
                    numeroPagina: 1,
                    paginasRestantes: 0
                };
            }

            // Resposta bem-sucedida
            const responseData = response.data;

            // A API retorna um objeto com estrutura:
            // { data: [...], totalRegistros, totalPaginas, numeroPagina, paginasRestantes, empty }
            const items = responseData.data || [];

            console.log(`[PNCP Client] ✅ Recebidas ${items.length} licitações (total: ${responseData.totalRegistros}, página ${responseData.numeroPagina}/${responseData.totalPaginas})`);

            return {
                success: true,
                data: items,
                totalRegistros: responseData.totalRegistros || 0,
                totalPaginas: responseData.totalPaginas || 0,
                numeroPagina: responseData.numeroPagina || 1,
                paginasRestantes: responseData.paginasRestantes || 0
            };

        } catch (error) {
            if (error.response?.status === 429) {
                // Rate limited - esperar mais tempo
                console.warn('[PNCP Client] Rate limited (429), aguardando 2s...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                return this.buscarLicitacoes(params); // Retry automático
            }

            if (error.response?.status === 503) {
                // Serviço indisponível - retry
                console.warn('[PNCP Client] Serviço indisponível (503), aguardando 3s...');
                await new Promise(resolve => setTimeout(resolve, 3000));
                return this.buscarLicitacoes(params);
            }

            console.error('[PNCP Client] ❌ Erro completo:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                url: error.config?.url,
                params: error.config?.params
            });

            throw new Error(`PNCP API Error [${error.response?.status || 'NETWORK'}]: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Buscar detalhes completos de uma licitação específica
     * NOTA: Este endpoint pode não estar disponível na API de consulta pública
     * @param {string} numeroSequencial - ID da licitação no PNCP
     */
    async buscarDetalhes(numeroSequencial) {
        await this.rateLimit();

        try {
            const response = await axios.get(
                `${this.baseURL}/contratacoes/${numeroSequencial}`,
                {
                    timeout: 30000,
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mabus-Platform/1.0'
                    }
                }
            );
            return { success: true, data: response.data };
        } catch (error) {
            console.warn(`[PNCP Client] Detalhes não disponível para ${numeroSequencial}`);
            return { success: false, data: null };
        }
    }

    /**
     * Buscar itens de uma licitação
     * ENDPOINT CORRETO: /api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/itens
     * 
     * @param {string} cnpj - CNPJ do órgão
     * @param {number} ano - Ano da compra
     * @param {number} sequencial - Sequencial da compra
     */
    async buscarItens(cnpj, ano, sequencial) {
        await this.rateLimit();

        // Endpoint correto descoberto por testes
        const url = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens`;

        try {
            console.log(`[PNCP Client] Buscando itens: ${cnpj}/${ano}/${sequencial}`);

            const response = await axios.get(url, {
                timeout: 30000,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mabus-Platform/1.0'
                }
            });

            // API retorna array direto
            const items = Array.isArray(response.data) ? response.data : [];
            console.log(`[PNCP Client] ✅ ${items.length} itens encontrados`);

            return {
                success: true,
                data: items
            };
        } catch (error) {
            if (error.response?.status === 404) {
                // Licitação sem itens publicados (comum)
                console.log(`[PNCP Client] Sem itens publicados`);
                return { success: false, data: [] };
            }

            console.warn(`[PNCP Client] Erro ao buscar itens: ${error.message}`);
            return { success: false, data: [] };
        }
    }
}

// Exportar singleton
module.exports = new PNCPClient();
