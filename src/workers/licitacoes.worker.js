const { Worker } = require('bullmq');
const connection = require('../queues/connection');
const database = require('../database');
const pncpClient = require('../services/pncp_client');
const licitacoesImporter = require('../services/licitacoes_importer');
const { updateSyncControl } = database;

// Rate limit helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const licitacoesWorker = new Worker('licitacoes-import', async (job) => {
    // Expect modalities to be an array, e.g. [8, 6] (Dispensa, Pregão)
    const { syncId, dataInicial, dataFinal, cnpjOrgao, modalities = [8, 6] } = job.data;

    // Checkpointing: Retrieve cursor logic
    // We need to know which modality we are processing and which page
    let currentModalityIndex = job.data.modalityIndex || 0;
    let currentPage = job.data.cursor || 1;

    console.log(`[Worker] 🚀 Starting Mass Import Job ${job.id} (SyncID: ${syncId})`);
    console.log(`[Worker] Modalities: ${modalities.join(', ')} | Resuming from ModalityIdx: ${currentModalityIndex}, Page: ${currentPage}`);

    await updateSyncControl(syncId, { status: 'running' });

    let imported = job.data.imported || 0;
    let duplicates = job.data.duplicates || 0;
    let errors = job.data.errors || 0;
    let totalProcessed = job.data.totalProcessed || 0;

    try {
        // Iterate through modalities
        for (let mIdx = currentModalityIndex; mIdx < modalities.length; mIdx++) {
            const modality = modalities[mIdx];
            job.log(`Switching to Modality ID: ${modality}`);

            let totalPages = null; // Will be discovered on first fetch

            // Loop pages indefinitely until we hit totalPages limit
            // Start from currentPage if resuming, otherwise 1
            let page = (mIdx === currentModalityIndex) ? currentPage : 1;

            while (true) {
                // Safety break if we exceed known total pages (once discovered)
                if (totalPages !== null && page > totalPages) {
                    job.log(`Reached end of pages for modality ${modality}.`);
                    break;
                }

                job.log(`Processing Modality ${modality} - Page ${page}/${totalPages || '?'}...`);

                // 1. Fetch from API
                const result = await pncpClient.buscarLicitacoes({
                    dataInicial: licitacoesImporter.formatDate(dataInicial),
                    dataFinal: licitacoesImporter.formatDate(dataFinal),
                    codigoModalidadeContratacao: modality,
                    cnpjOrgao,
                    pagina: page,
                    tamanhoPagina: 50 // Max page size for efficiency
                });

                // Update total pages knowledge
                if (result.success) {
                    totalPages = result.totalPaginas;
                    // If total pages is 0, we can break immediately
                    if (totalPages === 0) {
                        job.log(`Modality ${modality} has no results.`);
                        break;
                    }
                }

                if (!result.success || !result.data || result.data.length === 0) {
                    job.log(`Page ${page} empty or error. Move next.`);
                    break;
                }

                totalProcessed += result.data.length;

                // 2. Process Items
                const processItem = async (lic) => {
                    if (!lic) return null;
                    try {
                        const licitacaoInfo = await licitacoesImporter.storeLicitacao(lic);
                        if (licitacaoInfo) {
                            await Promise.all([
                                licitacoesImporter.storeItens(licitacaoInfo).catch(err => console.warn(`Item error: ${err.message}`)),
                                licitacoesImporter.storeArquivos(licitacaoInfo).catch(err => console.warn(`File error: ${err.message}`))
                            ]);
                        }
                        return 'imported';
                    } catch (err) {
                        if (err.code === 'ER_DUP_ENTRY' || err.message.includes('duplicate')) {
                            return 'duplicate';
                        }
                        return 'error';
                    }
                };

                // Chunk processing for database load management
                const chunk = 5;
                for (let i = 0; i < result.data.length; i += chunk) {
                    const batch = result.data.slice(i, i + chunk);
                    const results = await Promise.all(batch.map(processItem));

                    imported += results.filter(r => r === 'imported').length;
                    duplicates += results.filter(r => r === 'duplicate').length;
                    errors += results.filter(r => r === 'error').length;
                }

                // 3. Update Checkpoint
                // We save the NEXT page as cursor
                await job.updateData({
                    ...job.data,
                    modalityIndex: mIdx,
                    cursor: page + 1,
                    imported,
                    duplicates,
                    errors,
                    totalProcessed
                });

                // 4. Update DB Control (User Feedback)
                await updateSyncControl(syncId, {
                    current_page: page,
                    total_pages: totalPages || 0, // Update total pages so user sees true progress
                    total_imported: imported,
                    total_duplicates: duplicates,
                    total_errors: errors
                });

                // Update BullMQ progress
                if (totalPages) {
                    await job.updateProgress({
                        current: page,
                        total: totalPages,
                        percent: Math.round((page / totalPages) * 100),
                        modality: modality
                    });
                }

                // Rate Limit: Sleep 2s to be polite
                await sleep(2000);

                page++;
            }

            // Reset cursor for next modality
            currentPage = 1;
        }

        // Finish
        await updateSyncControl(syncId, {
            status: 'completed',
            finished_at: new Date()
        });

        job.log('Mass Import Job completed successfully.');
        return { imported, duplicates, errors };

    } catch (error) {
        console.error(`[Worker] Job ${job.id} failed:`, error);
        await updateSyncControl(syncId, {
            status: 'failed',
            error_message: error.message
        });
        throw error;
    }

}, {
    connection,
    concurrency: 1,
    limiter: {
        max: 1,
        duration: 1000
    }
});

licitacoesWorker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job.id} failed with ${err.message}`);
});

console.log('[Worker] Licitacoes Mass Worker initialized 🚀');

module.exports = licitacoesWorker;
