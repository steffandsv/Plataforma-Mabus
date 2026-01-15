const axios = require('axios');

/**
 * Cliente HTTP para API do PNCP (Portal Nacional de Contratações Públicas)
 * 
 * Documentação: https://pncp.gov.br/api/consulta
 * Rate limit: 5 requisições/segundo
 */
class PNCPClient {
    constructor() {
        this.baseURL = 'https://pncp.gov.br/api/pncp/v1';
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
     * @param {Object} params - { dataInicial, dataFinal, cnpjOrgao, pagina, tamanhoPagina }
     * @returns {Promise<Object>} { success, data, pagination, total }
     */
    async buscarLicitacoes(params = {}) {
        await this.rateLimit();

        const queryParams = {
            dataInicial: params.dataInicial, // formato: YYYYMMDD
            dataFinal: params.dataFinal,      // formato: YYYYMMDD
            pagina: params.pagina || 1,
            tamanhoPagina: params.tamanhoPagina || 500 // máx suportado pela API
        };

        if (params.cnpjOrgao) {
            queryParams.cnpjOrgao = params.cnpjOrgao;
        }

        try {
            console.log(`[PNCP Client] Buscando licitações: ${params.dataInicial} a ${params.dataFinal}, página ${queryParams.pagina}`);

            const response = await axios.get(`${this.baseURL}/contratacoes/publicacao`, {
                params: queryParams,
                timeout: 30000,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mabus-Platform/1.0'
                }
            });

            // A API pode retornar diferentes formatos
            const data = response.data.items || response.data.data || response.data;
            const items = Array.isArray(data) ? data : [];

            return {
                success: true,
                data: items,
                pagination: response.data.pagination || null,
                total: response.data.total || items.length
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

            console.error('[PNCP Client] Erro:', error.response?.data || error.message);
            throw new Error(`PNCP API Error [${error.response?.status || 'NETWORK'}]: ${error.message}`);
        }
    }

    /**
     * Buscar detalhes completos de uma licitação específica
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
            throw new Error(`PNCP Details Error: ${error.message}`);
        }
    }

    /**
     * Buscar itens de uma licitação
     * @param {string} numeroSequencial - ID da licitação no PNCP
     */
    async buscarItens(numeroSequencial) {
        await this.rateLimit();

        try {
            const response = await axios.get(
                `${this.baseURL}/contratacoes/${numeroSequencial}/itens`,
                {
                    timeout: 30000,
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mabus-Platform/1.0'
                    }
                }
            );

            const items = response.data.items || response.data.data || response.data;
            return {
                success: true,
                data: Array.isArray(items) ? items : []
            };
        } catch (error) {
            // Nem todas licitações têm itens detalhados
            console.warn(`[PNCP Client] Erro ao buscar itens: ${error.message}`);
            return { success: false, data: [] };
        }
    }
}

// Exportar singleton
module.exports = new PNCPClient();
