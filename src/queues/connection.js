const Redis = require('ioredis');

const connection = new Redis(process.env.REDIS_URL || 'redis://plataforma_mabus_redis:6379', {
    maxRetriesPerRequest: null,
});

module.exports = connection;
