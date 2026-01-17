const { Worker } = require('bullmq');
const connection = require('../queues/connection'); // Verify if needed, usually processor is just a function
const database = require('../database');
const pncpClient = require('../services/pncp_client');
const licitacoesImporter = require('../services/licitacoes_importer'); // We use store methods
const { updateSyncControl } = database;

// Concurrency control helper (same as in importer)
const pLimit = require('p-limit');
const limiter = pLimit(16); // 16 parallel requests max for details

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Main Processor Function
 * This runs inside a Sandboxed Worker Thread
 */
module.exports = async (job) => {
    // Expect modalities to be an array, e.g. [8, 6] (Dispensa, Pregão)
    const { syncId, dataInicial, dataFinal, cnpjOrgao, modalities = [8, 6] } = job.data;

    // Checkpointing: Retrieve cursor logic
    let currentModalityIndex = job.data.modalityIndex || 0;
    let currentPage = job.data.cursor || 1;

    console.log(`[Processor] 🚀 Starting Job ${job.id} (SyncID: ${syncId})`);
    console.log(`[Processor] Modalities: ${modalities.join(', ')} | Resuming from ModalityIdx: ${currentModalityIndex}, Page: ${currentPage}`);

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
                // Graceful check if job should stop? (BullMQ handles SIGTERM somewhat, but we can check job.token if needed for cancellability)

                // Safety break if we exceed known total pages (once discovered)
                if (totalPages !== null && page > totalPages) {
                    job.log(`Reached end of pages for modality ${modality}.`);
                    break;
                }

                job.log(`Processing Modality ${modality} - Page ${page}/${totalPages || '?'}...`);

                // 1. Fetch from API (Licitações List)
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

                const pageLogs = [];

                // 2. Process Items in Parallel
                // "Deep Fetch": Parse Licitacao -> Fetch Items -> Fetch Files
                // Use p-limit to control concurrency (e.g. 16 simultaneous "Deep Fetches")

                const processPromises = result.data.map(lic =>
                    limiter(async () => {
                        if (!lic) return 'error';
                        try {
                            // A. Store Basic Data
                            const licitacaoInfo = await licitacoesImporter.storeLicitacao(lic);

                            if (licitacaoInfo) {
                                // B & C. Fetch Items and Files in Parallel
                                await Promise.all([
                                    licitacoesImporter.storeItens(licitacaoInfo).catch(err => {
                                        console.warn(`Item error ${lic.numeroControlePNCP}: ${err.message}`);
                                        pageLogs.push({ type: 'WARN', msg: `Item error ${lic.numeroControlePNCP}`, detail: err.message, ts: new Date() });
                                    }),
                                    licitacoesImporter.storeArquivos(licitacaoInfo).catch(err => {
                                        console.warn(`File error ${lic.numeroControlePNCP}: ${err.message}`);
                                        // Optional: don't log file errors to DB to avoid spam if it's just 404s
                                    })
                                ]);
                                return 'imported';
                            } else {
                                // Probably duplicate or invalid
                                return 'duplicate';
                            }
                        } catch (err) {
                            if (err.code === 'ER_DUP_ENTRY' || err.message.includes('duplicate')) {
                                return 'duplicate';
                            }
                            console.error(`Error processing ${lic.numeroControlePNCP}: ${err.message}`);

                            // Log Rate Limits explicitly
                            if (err.message.includes('429') || err.message.includes('Too Many Requests')) {
                                pageLogs.push({ type: 'ERROR', msg: 'RATE LIMIT HIT (429)', detail: `Paused on ${lic.numeroControlePNCP}`, ts: new Date() });
                            } else {
                                pageLogs.push({ type: 'ERROR', msg: `Failed ${lic.numeroControlePNCP}`, detail: err.message, ts: new Date() });
                            }
                            return 'error';
                        }
                    })
                );

                const results = await Promise.all(processPromises);

                const pageImported = results.filter(r => r === 'imported').length;
                const pageDuplicates = results.filter(r => r === 'duplicate').length;
                const pageErrors = results.filter(r => r === 'error').length;

                imported += pageImported;
                duplicates += pageDuplicates;
                errors += pageErrors;

                // 3. Update Checkpoint
                // Save NEXT page state
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
                // Send logs if we have them
                const updateData = {
                    current_page: page,
                    total_pages: totalPages || 0,
                    total_imported: imported,
                    total_duplicates: duplicates,
                    total_errors: errors
                };

                if (pageLogs.length > 0) {
                    updateData.logs = pageLogs;
                }

                await updateSyncControl(syncId, updateData);

                // Update BullMQ progress
                if (totalPages) {
                    await job.updateProgress({
                        current: page,
                        total: totalPages,
                        percent: Math.round((page / totalPages) * 100),
                        modality: modality
                    });
                }

                // Rate Limit: Sleep slightly to be polite, though concurrency limit helps
                await sleep(1000); // 1 second between pages

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
        console.error(`[Processor] Job ${job.id} failed:`, error);
        await updateSyncControl(syncId, {
            status: 'failed',
            error_message: error.message
        });
        throw error;
    }
};
