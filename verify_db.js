require('dotenv').config();
const db = require('./src/database');

async function testConnection() {
    console.log('Testing Database Connection...');
    try {
        console.log('Initializing DB...');
        // triggering initDB via getLatestSyncControl or similar simple read
        const admin = await db.getUserByUsername('admin');
        console.log('Admin check result:', admin ? 'Found' : 'Not Found (Created Default?)');

        console.log('Testing Licitacoes Query (Empty)...');
        const licitacoes = await db.getLicitacoes({}, 1, 0);
        console.log('Licitacoes query success, count:', licitacoes.length);

        console.log('✅ VERIFICATION SUCCESSFUL: Connected to Postgres and ran queries.');
        process.exit(0);
    } catch (error) {
        console.error('❌ VERIFICATION FAILED:', error);
        process.exit(1);
    }
}

testConnection();
