const { Worker } = require('bullmq');
const connection = require('../queues/connection');
const database = require('../database');
const pncpClient = require('../services/pncp_client');
const licitacoesImporter = require('../services/licitacoes_importer'); // Reuse storage logic
const { updateSyncControl } = database;

// Rate limit helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const licitacoesWorker = new Worker('licitacoes-import', async (job) => {
    const { syncId, dataInicial, dataFinal, cnpjOrgao, codigoModalidadeContratacao, maxPages = 10 } = job.data;

    // Checkpointing: Retrieve cursor
    let currentPage = job.data.cursor || 1;

    console.log(`[Worker] 🚀 Starting Job ${job.id} (SyncID: ${syncId}) - Page ${currentPage}/${maxPages}`);
    job.log(`Starting import from ${dataInicial} to ${dataFinal}`);

    // Update DB status to running if resuming or starting
    await updateSyncControl(syncId, { status: 'running' });

    let imported = job.data.imported || 0;
    let duplicates = job.data.duplicates || 0;
    let errors = job.data.errors || 0;
    let totalProcessed = job.data.totalProcessed || 0;

    try {
        for (let page = currentPage; page <= maxPages; page++) {
            // Check if job was cancelled or worker is closing
            // if (job.isCompleted() || job.isFailed()) break; // Not needed inside loop typically unless long running per iteration

            job.log(`Processing page ${page}...`);
            await job.updateProgress({
                current: page,
                total: maxPages,
                percent: Math.round((page / maxPages) * 100)
            });

            // 1. Fetch from API
            const result = await pncpClient.buscarLicitacoes({
                dataInicial: licitacoesImporter.formatDate(dataInicial),
                dataFinal: licitacoesImporter.formatDate(dataFinal),
                codigoModalidadeContratacao: codigoModalidadeContratacao || 8,
                cnpjOrgao,
                pagina: page,
                tamanhoPagina: 50
            });

            if (!result.success || !result.data || result.data.length === 0) {
                job.log(`Page ${page} empty. Finishing.`);
                break;
            }

            totalProcessed += result.data.length;

            // 2. Process Items (Reuse LicitacoesImporter logic)
            // We process sequentially or with limited concurrency here. 
            // Reusing the batch logic's item processing but running it locally
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

            // Run in parallel chunks of 5 to respect rate limits/db load inside the worker
            const chunk = 5;
            for (let i = 0; i < result.data.length; i += chunk) {
                const batch = result.data.slice(i, i + chunk);
                const results = await Promise.all(batch.map(processItem));

                imported += results.filter(r => r === 'imported').length;
                duplicates += results.filter(r => r === 'duplicate').length;
                errors += results.filter(r => r === 'error').length;
            }

            // 3. Update Checkpoint
            await job.updateData({
                ...job.data,
                cursor: page + 1,
                imported,
                duplicates,
                errors,
                totalProcessed
            });

            // 4. Update DB Control
            await updateSyncControl(syncId, {
                current_page: page,
                total_imported: imported,
                total_duplicates: duplicates,
                total_errors: errors
            });

            // Rate Limit manually if needed, but BullMQ limiter handles job dispatch rate. 
            // Inside the job, we are fetching pages. PNCP might block if we browse too fast.
            // Sleep 2 seconds between pages.
            await sleep(2000);

            if (result.data.length < 50) {
                job.log('Last page reached.');
                break;
            }
        }

        // Finish
        await updateSyncControl(syncId, {
            status: 'completed',
            finished_at: new Date()
        });

        job.log('Job completed successfully.');
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
    concurrency: 1, // One job per worker instance for now (fetching pages is heavy)
    limiter: {
        max: 1,      // 1 job max
        duration: 1000 // per 1 second (global rate limit for this queue) - though page fetching is internal
    }
});

// Graceful Shutdown
licitacoesWorker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job.id} failed with ${err.message}`);
});

console.log('[Worker] Licitacoes Worker initialized 🚀');

module.exports = licitacoesWorker;
