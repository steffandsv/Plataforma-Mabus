const pncpClient = require('./pncp_client');
const {
    createLicitacao,
    createLicitacaoItem,
    createSyncControl,
    updateSyncControl,
    getActiveSyncControl
} = require('../database');

/**
 * Serviço para importação em lote de licitações do PNCP
 */
class LicitacoesImporter {

    /**
     * Importar licitações em lote com controle de duplicatas
     * @param {Object} params - { dataInicial, dataFinal, maxPages, cnpjOrgao }
     */
    async importBatch(params) {
        const { dataInicial, dataFinal, maxPages = 10, cnpjOrgao } = params;

        // Verificar se já existe importação rodando
        const existing = await getActiveSyncControl();
        if (existing) {
            throw new Error('Já existe uma importação em andamento.');
        }

        console.log(`[Licitações Importer] 🚀 Iniciando importação: ${dataInicial} a ${dataFinal}`);

        // Criar registro de controle
        const syncId = await createSyncControl({
            syncType: 'manual',
            dataInicial,
            dataFinal,
            cnpjOrgao,
            totalPages: maxPages,
            itemsPerPage: 500
        });

        let imported = 0;
        let duplicates = 0;
        let errors = 0;
        let totalProcessed = 0;

        try {
            for (let page = 1; page <= maxPages; page++) {
                console.log(`[Licitações Importer] 📄 Processando página ${page}/${maxPages}...`);

                // Buscar licitações via API PNCP
                const result = await pncpClient.buscarLicitacoes({
                    dataInicial: this.formatDate(dataInicial),
                    dataFinal: this.formatDate(dataFinal),
                    codigoModalidadeContratacao: params.codigoModalidadeContratacao || 8,
                    cnpjOrgao,
                    pagina: page,
                    tamanhoPagina: 50 // máximo suportado pela API (descoberto por testes)
                });

                if (!result.success || !result.data || result.data.length === 0) {
                    console.log(`[Licitações Importer] ✅ Página ${page} vazia, finalizando.`);
                    break;
                }

                totalProcessed += result.data.length;
                console.log(`[Licitações Importer] 📦 Encontradas ${result.data.length} licitações nesta página`);

                // Processar cada licitação
                for (const lic of result.data) {
                    if (!lic) continue;

                    try {
                        // storeLicitacao agora retorna objeto com {id, cnpj, ano, sequencial}
                        const licitacaoInfo = await this.storeLicitacao(lic);

                        // Tentar buscar e salvar itens usando endpoint correto
                        if (licitacaoInfo) {
                            await this.storeItens(licitacaoInfo);
                        }

                        imported++;

                        if (imported % 10 === 0) {
                            console.log(`[Licitações Importer] ✓ ${imported} licitações importadas...`);
                        }
                    } catch (err) {
                        if (err.code === 'ER_DUP_ENTRY') {
                            duplicates++;
                        } else {
                            errors++;
                            const id = lic.numeroControlePNCP || lic.sequencialContratacao || 'UNKNOWN';
                            console.error(`[Licitações Importer] ❌ Erro ao salvar ${id}:`, err.message);
                        }
                    }
                }

                // Atualizar progresso
                await updateSyncControl(syncId, {
                    current_page: page,
                    total_imported: imported,
                    total_duplicates: duplicates,
                    total_errors: errors
                });

                // Se última página tinha menos que 50, acabou
                if (result.data.length < 50) {
                    console.log(`[Licitações Importer] ✅ Última página (${result.data.length} itens), finalizando.`);
                    break;
                }
            }

            // Finalizar
            await updateSyncControl(syncId, {
                status: 'completed',
                finished_at: true
            });

            console.log(`[Licitações Importer] 🎉 Importação concluída!`);
            console.log(`[Licitações Importer] ✓ Importadas: ${imported}`);
            console.log(`[Licitações Importer] ⟳ Duplicadas: ${duplicates}`);
            console.log(`[Licitações Importer] ✗ Erros: ${errors}`);
            console.log(`[Licitações Importer] 📊 Total processado: ${totalProcessed}`);

            return {
                success: true,
                imported,
                duplicates,
                errors,
                totalProcessed,
                syncId
            };

        } catch (error) {
            await updateSyncControl(syncId, {
                status: 'failed',
                error_message: error.message,
                finished_at: true
            });

            console.error(`[Licitações Importer] 💥 Falha crítica:`, error);
            throw error;
        }
    }

    /**
     * Armazenar licitação no banco de dados com TODOS os campos da API
     */
    async storeLicitacao(raw) {
        const numeroSeq = raw.numeroControlePNCP;

        if (!numeroSeq) {
            throw new Error('Licitação sem identificador válido');
        }

        // Extrair dados para buscar itens depois
        const cnpj = raw.orgaoEntidade?.cnpj;
        const ano = raw.anoCompra;
        const sequencial = raw.sequencialCompra;

        // Preparar metadata JSON com campos não-estruturados
        const metadata = {
            amparoLegalCompleto: raw.amparoLegal,
            unidadeOrgaoCompleto: raw.unidadeOrgao,
            orgaoSubRogado: raw.orgaoSubRogado,
            unidadeSubRogada: raw.unidadeSubRogada,
            fontesOrcamentarias: raw.fontesOrcamentarias || [],
            justificativaPresencial: raw.justificativaPresencial
        };

        const data = {
            // Identificadores
            numeroSequencial: numeroSeq,
            numeroControle: raw.numeroCompra,
            anoCompra: ano,
            sequencialCompra: sequencial,
            numeroCompra: raw.numeroCompra,
            processo: raw.processo,

            // Órgão
            cnpjOrgao: cnpj,
            razaoSocialOrgao: raw.orgaoEntidade?.razaoSocial,
            poder: raw.orgaoEntidade?.poderId,
            esfera: raw.orgaoEntidade?.esferaId,

            // Objeto e Informações
            objetoCompra: raw.objetoCompra,
            informacaoComplementar: raw.informacaoComplementar,

            // Situação e Modalidade
            situacaoCompra: raw.situacaoCompraNome,
            modalidadeLicitacao: raw.modalidadeNome,
            modoDisputa: raw.modoDisputaNome,  // manter para compatibilidade
            modoDisputaId: raw.modoDisputaId,
            modoDisputaNome: raw.modoDisputaNome,
            criterioJulgamento: raw.criterioJulgamentoId,

            // Tipo de Instrumento
            tipoInstrumentoCodigo: raw.tipoInstrumentoConvocatorioCodigo,
            tipoInstrumentoNome: raw.tipoInstrumentoConvocatorioNome,

            // Valores
            valorEstimadoTotal: raw.valorTotalEstimado || 0,
            valorTotalHomologado: raw.valorTotalHomologado,

            // Datas
            dataPublicacaoPncp: this.parseDate(raw.dataPublicacaoPncp),
            dataAberturaProposta: this.parseDate(raw.dataAberturaProposta),
            dataEncerramentoProposta: this.parseDate(raw.dataEncerramentoProposta),
            dataInclusao: this.parseDate(raw.dataInclusao),
            dataAtualizacao: this.parseDate(raw.dataAtualizacao),
            dataAtualizacaoGlobal: this.parseDate(raw.dataAtualizacaoGlobal),

            // Links (CRÍTICO!)
            linkSistemaOrigem: raw.linkSistemaOrigem,
            linkProcessoEletronico: raw.linkProcessoEletronico,

            // Flags
            srp: raw.srp || false,

            // Usuário
            usuarioNome: raw.usuarioNome,

            // Localização (unidadeOrgao)
            ufSigla: raw.unidadeOrgao?.ufSigla,
            ufNome: raw.unidadeOrgao?.ufNome,
            municipioNome: raw.unidadeOrgao?.municipioNome,
            codigoIbge: raw.unidadeOrgao?.codigoIbge,
            codigoUnidade: raw.unidadeOrgao?.codigoUnidade,
            nomeUnidade: raw.unidadeOrgao?.nomeUnidade,

            // Amparo Legal
            amparoLegalCodigo: raw.amparoLegal?.codigo,
            amparoLegalNome: raw.amparoLegal?.nome,
            amparoLegalDescricao: raw.amparoLegal?.descricao,

            // Event sourcing + metadata
            rawData: raw,
            metadata: metadata
        };

        const licitacaoId = await createLicitacao(data);

        // Retornar info necessária para buscar itens
        return {
            id: licitacaoId,
            cnpj,
            ano,
            sequencial
        };
    }

    /**
     * Buscar e armazenar itens de uma licitação
     * @param {Object} licitacaoInfo - {id, cnpj, ano, sequencial}
     */
    async storeItens(licitacaoInfo) {
        const { id, cnpj, ano, sequencial } = licitacaoInfo;

        if (!cnpj || !ano || !sequencial) {
            console.warn(`[Importer] ⚠️ Dados insuficientes para buscar itens (cnpj=${cnpj}, ano=${ano}, seq=${sequencial})`);
            return 0;
        }

        try {
            // Usar endpoint correto: /api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/itens
            const result = await pncpClient.buscarItens(cnpj, ano, sequencial);

            if (!result.success || !result.data || result.data.length === 0) {
                console.log(`[Importer] Sem itens publicados para esta licitação`);
                return 0;
            }

            console.log(`[Importer] 📦 Encontrados ${result.data.length} itens, salvando...`);
            let savedItems = 0;

            for (const item of result.data) {
                try {
                    await createLicitacaoItem(id, {
                        numeroItem: item.numeroItem || item.numero,
                        descricaoItem: item.descricao,
                        quantidade: item.quantidade || 0,
                        unidadeMedida: item.unidadeMedida || 'UN',
                        valorUnitarioEstimado: item.valorUnitarioEstimado || item.valorUnitario || 0,
                        valorTotalEstimado: item.valorTotal || (item.quantidade * (item.valorUnitarioEstimado || 0)),
                        codigoCatmat: item.catalogoSelecionado?.codigo || item.itemCatalogo || item.codigoCatmat,
                        descricaoCatmat: item.catalogoSelecionado?.descricao || item.descricaoCatmat,
                        materialOuServico: item.materialOuServico,
                        materialOuServicoNome: item.materialOuServicoNome
                    });
                    savedItems++;
                } catch (itemErr) {
                    // Duplicata ou erro - continuar
                    console.warn(`[Importer] Erro ao salvar item ${item.numeroItem}: ${itemErr.message}`);
                }
            }

            console.log(`[Importer] ✅ ${savedItems}/${result.data.length} itens salvos com sucesso`);
            return savedItems;

        } catch (err) {
            console.warn(`[Importer] Erro ao buscar/salvar itens: ${err.message}`);
            return 0;
        }
    }

    /**
     * Formatadores de data
     */
    formatDate(dateStr) {
        // Converter YYYY-MM-DD para YYYYMMDD
        if (!dateStr) return null;
        return dateStr.replace(/-/g, '');
    }

    parseDate(dateStr) {
        if (!dateStr) return null;
        try {
            return new Date(dateStr);
        } catch (e) {
            return null;
        }
    }

    extractYear(dateStr) {
        if (!dateStr) return null;
        try {
            return new Date(dateStr).getFullYear();
        } catch (e) {
            return null;
        }
    }
}

// Exportar singleton
module.exports = new LicitacoesImporter();
