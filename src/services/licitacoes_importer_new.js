const pncpClient = require('./pncp_client');
const {
    createLicitacao,
    createLicitacaoItem,
    createLicitacaoArquivo,
    createSyncControl,
    updateSyncControl,
    getActiveSyncControl
} = require('../database');

// Controle de concorrência: máx 16 operações paralelas simultâneas
class ConcurrencyLimiter {
    constructor(limit = 16) {
        this.limit = limit;
        this.running = 0;
        this.queue = [];
    }

    async run(fn) {
        while (this.running >= this.limit) {
            await new Promise(resolve => this.queue.push(resolve));
        }

        this.running++;
        try {
            return await fn();
        } finally {
            this.running--;
            const resolve = this.queue.shift();
            if (resolve) resolve();
        }
    }
}

const limiter = new ConcurrencyLimiter(16);

class LicitacoesImporter {
    constructor() {
        this.syncId = null;
    }

    /**
     * Importar licitações em lote do PNCP
     */
    async importBatch(params) {
        const { dataInicial, dataFinal, maxPages = 10, codigoModalidadeContratacao = 8, cnpjOrgao } = params;

        console.log(`[Licitações Importer] 🚀 Iniciando importação: ${dataInicial} a ${dataFinal}, modalidade ${codigoModalidadeContratacao}`);

        // Registrar sync control
        this.syncId = await createSyncControl({
            syncType: 'batch_import',
            dataInicial,
            dataFinal,
            cnpjOrgao,
            totalPages: maxPages,
            itemsPerPage: 50
        });

        let imported = 0;
        let duplicates = 0;
        let errors = 0;
        let totalProcessed = 0;

        try {
            for (let page = 1; page <= maxPages; page++) {
                const result = await pncpClient.buscarLicitacoes({
                    dataInicial: this.formatDate(dataInicial),
                    dataFinal: this.formatDate(dataFinal),
                    codigoModalidadeContratacao,
                    cnpjOrgao,
                    pagina: page,
                    tamanhoPagina: 50
                });

                if (!result.success || !result.data || result.data.length === 0) {
                    console.log(`[Licitações Importer] ✅ Página ${page} vazia, finalizando.`);
                    break;
                }

                totalProcessed += result.data.length;
                console.log(`[Licitações Importer] 📦 Encontradas ${result.data.length} licitações nesta página`);

                // Processar licitações com paralelismo controlado
                const promises = result.data.map(lic =>
                    limiter.run(async () => {
                        if (!lic) return;

                        try {
                            // Salvar licitação e obter info para buscar detalhes
                            const licitacaoInfo = await this.storeLicitacao(lic);

                            // Buscar ITENS e ARQUIVOS em PARALELO
                            if (licitacaoInfo) {
                                await Promise.all([
                                    this.storeItens(licitacaoInfo).catch(err =>
                                        console.warn(`[Importer] Erro nos itens: ${err.message}`)
                                    ),
                                    this.storeArquivos(licitacaoInfo).catch(err =>
                                        console.warn(`[Importer] Erro nos arquivos: ${err.message}`)
                                    )
                                ]);
                            }

                            return 'imported';
                        } catch (err) {
                            if (err.code === 'ER_DUP_ENTRY') {
                                return 'duplicate';
                            } else {
                                const id = lic.numeroControlePNCP || 'UNKNOWN';
                                console.error(`[Licitações Importer] ❌ Erro ao salvar ${id}:`, err.message);
                                return 'error';
                            }
                        }
                    })
                );

                // Aguardar todas as licitações desta página
                const results = await Promise.all(promises);

                // Contabilizar resultados
                imported += results.filter(r => r === 'imported').length;
                duplicates += results.filter(r => r === 'duplicate').length;
                errors += results.filter(r => r === 'error').length;

                console.log(`[Licitações Importer] ✓ Página ${page} concluída: ${imported} importadas, ${duplicates} duplicatas`);

                // Atualizar progresso
                await updateSyncControl(this.syncId, {
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

            // Finalizar com sucesso
            await updateSyncControl(this.syncId, {
                status: 'completed',
                finished_at: new Date()
            });

            console.log(`[Licitações Importer] ✅ Importação concluída!`);
            console.log(`  Importadas: ${imported}`);
            console.log(`  Duplicatas: ${duplicates}`);
            console.log(`  Erros: ${errors}`);

            return {
                success: true,
                imported,
                duplicates,
                errors,
                totalProcessed
            };

        } catch (err) {
            console.error(`[Licitações Importer] 💥 Falha crítica:`, err);

            await updateSyncControl(this.syncId, {
                status: 'failed',
                finished_at: new Date(),
                error_message: err.message
            });

            throw err;
        }
    }

    // ... (manter storeLicitacao, storeItens existentes)

    /**
     * Buscar e armazenar arquivos/anexos de uma licitação
     * @param {Object} licitacaoInfo - {id, cnpj, ano, sequencial}
     */
    async storeArquivos(licitacaoInfo) {
        const { id, cnpj, ano, sequencial } = licitacaoInfo;

        if (!cnpj || !ano || !sequencial) {
            return 0;
        }

        try {
            const result = await pncpClient.buscarArquivos(cnpj, ano, sequencial);

            if (!result.success || !result.data || result.data.length === 0) {
                return 0;
            }

            console.log(`[Importer] 📎 ${result.data.length} arquivo(s) encontrado(s), salvando...`);
            let savedFiles = 0;

            for (const arquivo of result.data) {
                try {
                    await createLicitacaoArquivo(id, {
                        sequencialDocumento: arquivo.sequencialDocumento,
                        titulo: arquivo.titulo,
                        tipoDocumentoId: arquivo.tipoDocumentoId,
                        tipoDocumentoNome: arquivo.tipoDocumentoNome,
                        tipoDocumentoDescricao: arquivo.tipoDocumentoDescricao,
                        url: arquivo.url,
                        dataPublicacao: this.parseDate(arquivo.dataPublicacaoPncp),
                        statusAtivo: arquivo.statusAtivo !== false
                    });
                    savedFiles++;
                } catch (err) {
                    console.warn(`[Importer] Erro ao salvar arquivo ${arquivo.titulo}: ${err.message}`);
                }
            }

            console.log(`[Importer] ✅ ${savedFiles}/${result.data.length} arquivo(s) salvo(s)`);
            return savedFiles;

        } catch (err) {
            console.warn(`[Importer] Erro ao buscar/salvar arquivos: ${err.message}`);
            return 0;
        }
    }

    formatDate(dateStr) {
        // Remover separadores: "2024-01-01" -> "20240101"
        return dateStr.replace(/-/g, '');
    }

    parseDate(dateStr) {
        if (!dateStr) return null;
        try {
            return new Date(dateStr).toISOString().slice(0, 19).replace('T', ' ');
        } catch {
            return null;
        }
    }

    extractYear(dateStr) {
        if (!dateStr) return null;
        try {
            return new Date(dateStr).getFullYear();
        } catch {
            return null;
        }
    }

    // storeLicitacao e storeItens permanecem iguais...
    // (copiar do arquivo existente)
}

module.exports = new LicitacoesImporter();
