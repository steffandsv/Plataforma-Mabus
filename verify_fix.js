require('dotenv').config();
const { initDB, getPool } = require('./src/database');

async function test() {
    console.log('--- STARTING DB INIT TEST ---');
    try {
        await initDB();
        console.log('✅ initDB completed without throw.');

        const pool = await getPool();
        if (!pool) {
            console.error('❌ Pool is null after initDB!');
        } else {
            console.log('✅ Pool acquired. Testing query...');
            await pool.query('SELECT NOW()');
            console.log('✅ Query success.');
        }
    } catch (e) {
        console.error('❌ CRITICAL ERROR IN initDB:', e);
        console.error(e.stack);
    }
    process.exit(0);
}

test();
