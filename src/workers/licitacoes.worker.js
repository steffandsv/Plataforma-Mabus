const { Worker } = require('bullmq');
const connection = require('../queues/connection');
const path = require('path');

// Sandboxed Worker Configuration
const processorPath = path.join(__dirname, 'licitacoesProcessor.js');

const licitacoesWorker = new Worker('licitacoes-import', processorPath, {
    connection,
    useWorkerThreads: true,
    concurrency: 1, // Run 1 page/job in parallel (Total up to 1 * 6 = 6 sub-requests)
    limiter: {
        max: 60,
        duration: 60000 // Global limit: 60 jobs (pages) per minute? 
        // Note: The internal loop does requests too. The limiter here limits JOBS. 
        // 1 Job = 1 Massive Sequence of pages? No, 1 Job = 1 User Request?
        // Wait, the User Request creates 1 Job which loops ALL pages.
        // So concurrency: 5 here allows 5 DIFFERENT USERS/JOBS to run at once.
        // The rate limiter here limits how many JOBS start per minute.
        // The internal processor handles its own rate limiting via sleeps and p-limit.
    },
    lockDuration: 300000 // 5 minutes lock (renewed automatically)
});

licitacoesWorker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job.id} failed with ${err.message}`);
});

licitacoesWorker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed!`);
});

console.log('[Worker] Licitacoes Sandboxed Worker initialized 🚀');

module.exports = licitacoesWorker;
