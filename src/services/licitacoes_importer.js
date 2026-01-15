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
                        const licitacaoId = await this.storeLicitacao(lic);

                        // Tentar buscar e salvar itens (se disponível)
                        if (licitacaoId && lic.numeroControlePNCP) {
                            await this.storeItens(licitacaoId, lic.numeroControlePNCP);
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
     * Armazenar licitação no banco de dados
     */
    async storeLicitacao(raw) {
        // Mapear campos da API PNCP para nosso schema
        // API PNCP usa camelCase, precisamos ser flexíveis
        const numeroSeq = raw.numeroControlePNCP || raw.sequencialContratacao || raw.numeroSequencial;

        if (!numeroSeq) {
            throw new Error('Licitação sem identificador válido');
        }

        const data = {
            numeroSequencial: numeroSeq,
            numeroControle: raw.numeroControle || raw.numeroCompra,
            anoCompra: raw.anoCompra || this.extractYear(raw.dataPublicacaoPncp),
            cnpjOrgao: raw.orgaoEntidade?.cnpj || raw.cnpj || raw.unidadeOrgao?.cnpj,
            razaoSocialOrgao: raw.orgaoEntidade?.razaoSocial || raw.razaoSocial || raw.unidadeOrgao?.nome,
            poder: raw.orgaoEntidade?.poderId || raw.poder,
            esfera: raw.orgaoEntidade?.esferaId || raw.esfera,
            objetoCompra: raw.objetoCompra || raw.objeto,
            informacaoComplementar: raw.informacaoComplementar || raw.informacoes,
            situacaoCompra: raw.situacaoCompra || raw.situacao,
            modalidadeLicitacao: raw.modalidadeId || raw.modalidade,
            modoDisputa: raw.modoDisputaId || raw.modoDisputa,
            criterioJulgamento: raw.criterioJulgamentoId || raw.criterioJulgamento,
            valorEstimadoTotal: raw.valorTotalEstimado || raw.valorEstimado || 0,
            valorTotalHomologado: raw.valorTotalHomologado || raw.valorHomologado || null,
            dataPublicacaoPncp: this.parseDate(raw.dataPublicacaoPncp),
            dataAberturaProposta: this.parseDate(raw.dataAberturaProposta),
            dataEncerramentoProposta: this.parseDate(raw.dataEncerramentoProposta || raw.dataEncerramento),
            rawData: raw // Event sourcing - dados completos em JSON
        };

        return await createLicitacao(data);
    }

    /**
     * Buscar e armazenar itens da licitação
     */
    async storeItens(licitacaoId, numeroSequencial) {
        try {
            const result = await pncpClient.buscarItens(numeroSequencial);

            if (result.success && result.data && result.data.length > 0) {
                for (const item of result.data) {
                    try {
                        await createLicitacaoItem(licitacaoId, {
                            numeroItem: item.numeroItem || item.numero,
                            descricaoItem: item.descricao,
                            quantidade: item.quantidade,
                            unidadeMedida: item.unidadeMedida || item.unidade,
                            valorUnitarioEstimado: item.valorUnitarioEstimado || item.valorUnitario,
                            valorTotalEstimado: item.valorTotalEstimado || item.valorTotal,
                            codigoCatmat: item.catalogoSelecionado?.codigo || item.codigoCatmat,
                            descricaoCatmat: item.catalogoSelecionado?.descricao || item.descricaoCatmat,
                            situacaoItem: item.situacao
                        });
                    } catch (err) {
                        // Silenciar erros de itens individuais
                        console.warn(`[Licitações Importer] Erro ao salvar item: ${err.message}`);
                    }
                }
            }
        } catch (err) {
            // Não é crítico se itens falharem
            console.warn(`[Licitações Importer] Não foi possível buscar itens para ${numeroSequencial}`);
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
