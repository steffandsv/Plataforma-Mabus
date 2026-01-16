const { Queue } = require('bullmq');
const connection = require('./connection');

const licitacoesQueue = new Queue('licitacoes-import', {
    connection,
    defaultJobOptions: {
        attempts: 5,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 200,      // Keep last 200 failed jobs for debugging
    },
});

module.exports = {
    licitacoesQueue,
};
