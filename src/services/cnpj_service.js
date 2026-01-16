const axios = require('axios');

/**
 * CNPJ Service - Integração com API OpenCNPJ
 * 
 * Fornece funcionalidades de:
 * - Validação de CNPJ
 * - Consulta à API OpenCNPJ (gratuita, sem auth)
 * - Transformação de dados para formato padronizado
 * - Cache in-memory com TTL
 * - Tratamento de erros robusto
 */

class CNPJService {
    constructor() {
        this.baseUrl = 'https://api.opencnpj.org';
        this.timeout = 5000;
        this.cache = new Map(); // Cache simples em memória
        this.cacheTTL = 3600000; // 1 hora em ms

        // Limpar cache expirado a cada 10 minutos
        setInterval(() => this._limparCacheExpirado(), 600000);
    }

    /**
     * Valida o formato do CNPJ (básico + dígito verificador)
     * @param {string} cnpj - CNPJ com ou sem formatação
     * @returns {boolean} True se válido
     */
    validarCNPJ(cnpj) {
        if (!cnpj) return false;

        // Remove formatação
        const numeros = cnpj.replace(/\D/g, '');

        // Verifica se tem 14 dígitos
        if (numeros.length !== 14) return false;

        // Verifica se não é sequência repetida (00000000000000, 11111111111111, etc)
        if (/^(\d)\1{13}$/.test(numeros)) return false;

        // Validação de dígito verificador
        return this._validarDigitoVerificador(numeros);
    }

    /**
     * Valida dígitos verificadores do CNPJ
     * @private
     */
    _validarDigitoVerificador(cnpj) {
        const calcularDigito = (cnpj, posicoes) => {
            let soma = 0;
            for (let i = 0; i < posicoes; i++) {
                soma += parseInt(cnpj.charAt(i)) * ((posicoes + 1 - i));
            }
            const resto = soma % 11;
            return resto < 2 ? 0 : 11 - resto;
        };

        const digito1 = calcularDigito(cnpj, 12);
        const digito2 = calcularDigito(cnpj, 13);

        return (
            parseInt(cnpj.charAt(12)) === digito1 &&
            parseInt(cnpj.charAt(13)) === digito2
        );
    }

    /**
     * Formata CNPJ para requisição (apenas números)
     * @param {string} cnpj - CNPJ com ou sem formatação
     * @returns {string} CNPJ com apenas números
     */
    formatarCNPJ(cnpj) {
        return cnpj.replace(/\D/g, '');
    }

    /**
     * Formata CNPJ para exibição (XX.XXX.XXX/XXXX-XX)
     * @param {string} cnpj - CNPJ com apenas números
     * @returns {string} CNPJ formatado
     */
    formatarCNPJMascara(cnpj) {
        const limpo = this.formatarCNPJ(cnpj);
        return limpo.replace(
            /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
            '$1.$2.$3/$4-$5'
        );
    }

    /**
     * Consulta dados completos do CNPJ na API OpenCNPJ
     * @param {string} cnpj - CNPJ com ou sem formatação
     * @returns {Promise<Object>} Dados da empresa
     * @throws {Error} Se CNPJ inválido ou não encontrado
     */
    async consultarCNPJ(cnpj) {
        try {
            // Validar formato
            if (!this.validarCNPJ(cnpj)) {
                const erro = new Error('CNPJ inválido ou em formato incorreto');
                erro.codigo = 'CNPJ_INVALIDO';
                erro.status = 400;
                throw erro;
            }

            // Formatar CNPJ para requisição
            const cnpjFormatado = this.formatarCNPJ(cnpj);

            // Verificar cache
            const dadosCache = this._obterCache(cnpjFormatado);
            if (dadosCache) {
                console.log(`[CNPJ Service] Cache HIT: ${cnpjFormatado}`);
                return dadosCache;
            }

            console.log(`[CNPJ Service] Consultando CNPJ: ${cnpjFormatado}`);

            // Fazer requisição à API
            const resposta = await axios.get(
                `${this.baseUrl}/${cnpjFormatado}`,
                {
                    timeout: this.timeout,
                    headers: {
                        'User-Agent': 'Plataforma-Mabus/1.0',
                        'Accept': 'application/json'
                    }
                }
            );

            // Transformar dados para formato padronizado
            const dadosTransformados = this._transformarDados(resposta.data);

            // Salvar no cache
            this._salvarCache(cnpjFormatado, dadosTransformados);

            return dadosTransformados;

        } catch (erro) {
            return this._tratarErro(erro, cnpj);
        }
    }

    /**
     * Transforma dados brutos da API OpenCNPJ para formato padronizado
     * @private
     */
    _transformarDados(dados) {
        return {
            cnpj: dados.cnpj,
            razaoSocial: dados.razao_social || dados.nome_fantasia,
            nomeFantasia: dados.nome_fantasia,
            situacaoCadastral: dados.situacao_cadastral,
            dataSituacao: dados.data_situacao_cadastral,
            matrizFilial: dados.matriz_filial,
            dataAbertura: dados.data_inicio_atividade,

            // CNAEs (essencial para matching)
            cnaePrincipal: {
                codigo: dados.cnae_principal,
                descricao: dados.cnae_principal_descricao || 'Não informado'
            },
            cnaesSecundarios: (dados.cnaes_secundarios || []).map(cnae => ({
                codigo: typeof cnae === 'string' ? cnae : cnae.codigo,
                descricao: typeof cnae === 'object' ? cnae.descricao : 'Não informado'
            })),

            // Endereço
            endereco: {
                logradouro: dados.logradouro,
                numero: dados.numero,
                complemento: dados.complemento,
                bairro: dados.bairro,
                cep: dados.cep,
                municipio: dados.municipio,
                uf: dados.uf
            },

            // Contatos
            contatos: {
                telefones: (dados.telefones || []).map(tel => ({
                    ddd: tel.ddd,
                    numero: tel.numero,
                    tipo: tel.is_fax ? 'fax' : 'comercial'
                })),
                email: dados.email
            },

            // Informações comerciais
            capitalSocial: parseFloat(
                (dados.capital_social || '0').toString().replace(',', '.')
            ),
            porteEmpresa: dados.porte_empresa,
            naturezaJuridica: dados.natureza_juridica,

            // Simples Nacional e MEI
            simples: {
                optante: dados.opcao_simples !== null,
                dataOpcao: dados.data_opcao_simples,
                mei: dados.opcao_mei !== null,
                dataMEI: dados.data_opcao_mei
            },

            // Sócios (PF com dados mascarados por privacidade)
            socios: (dados.QSA || dados.socios || []).map(socio => ({
                nome: socio.nome_socio || socio.nome,
                cpfCnpj: socio.cnpj_cpf_socio || socio.cpf_cnpj, // Mascarado: ***000000**
                qualificacao: socio.qualificacao_socio || socio.qualificacao,
                dataEntrada: socio.data_entrada_sociedade || socio.data_entrada,
                tipo: socio.identificador_socio || socio.tipo,
                faixaEtaria: socio.faixa_etaria
            })),

            // Metadata
            consultadoEm: new Date().toISOString()
        };
    }

    /**
     * Trata erros de requisição
     * @private
     */
    _tratarErro(erro, cnpj) {
        console.error(`[CNPJ Service] Erro ao consultar CNPJ ${cnpj}:`, erro.message);

        if (erro.response?.status === 404) {
            const erro404 = new Error(
                `CNPJ ${cnpj} não encontrado na base de dados da Receita Federal`
            );
            erro404.codigo = 'CNPJ_NAO_ENCONTRADO';
            erro404.status = 404;
            throw erro404;
        }

        if (erro.response?.status === 429) {
            const erroLimite = new Error(
                'Limite de requisições excedido. Aguarde alguns segundos e tente novamente.'
            );
            erroLimite.codigo = 'RATE_LIMIT_EXCEDIDO';
            erroLimite.status = 429;
            throw erroLimite;
        }

        if (erro.code === 'ECONNABORTED' || erro.code === 'ETIMEDOUT') {
            const erroTimeout = new Error(
                'Requisição expirou (timeout). Tente novamente.'
            );
            erroTimeout.codigo = 'TIMEOUT';
            erroTimeout.status = 504;
            throw erroTimeout;
        }

        // Re-lançar erros customizados
        if (erro.codigo) throw erro;

        // Erro genérico
        const erroGenerico = new Error(
            `Erro ao consultar CNPJ: ${erro.message}`
        );
        erroGenerico.codigo = 'ERRO_GERAL';
        erroGenerico.status = 500;
        throw erroGenerico;
    }

    /**
     * Obtém dados do cache se não expirados
     * @private
     */
    _obterCache(cnpj) {
        const item = this.cache.get(cnpj);

        if (!item) return null;

        // Verificar se expirou
        if (Date.now() > item.expiracao) {
            this.cache.delete(cnpj);
            return null;
        }

        return item.valor;
    }

    /**
     * Salva dados no cache
     * @private
     */
    _salvarCache(cnpj, dados) {
        this.cache.set(cnpj, {
            valor: dados,
            expiracao: Date.now() + this.cacheTTL
        });
    }

    /**
     * Limpa entradas expiradas do cache
     * @private
     */
    _limparCacheExpirado() {
        const agora = Date.now();
        for (const [chave, item] of this.cache) {
            if (agora > item.expiracao) {
                this.cache.delete(chave);
            }
        }
    }

    /**
     * Informações sobre o cache
     */
    getCacheInfo() {
        return {
            tamanho: this.cache.size,
            ttl: this.cacheTTL
        };
    }
}

// Singleton
module.exports = new CNPJService();
