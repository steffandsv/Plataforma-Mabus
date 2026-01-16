const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

let pool = null;

async function initDB() {
    if (pool) return;

    try {
        const config = {
            host: process.env.DB_HOST || 'srv466.hstgr.io',
            user: process.env.DB_USER || 'u225637494_fiomb',
            password: process.env.DB_PASS || '20SKDMasx',
            database: process.env.DB_DB || 'u225637494_fiomb',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            ssl: { rejectUnauthorized: false } // Often needed for external hosting
        };

        pool = mysql.createPool(config);

        // Verify connection
        const connection = await pool.getConnection();
        console.log('[Database] ✅ Connected to MariaDB/MySQL!');
        connection.release();

        // --- TASKS TABLE ---
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(255),
                status VARCHAR(50),
                cep VARCHAR(20),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                finished_at DATETIME,
                input_file VARCHAR(255),
                output_file VARCHAR(255),
                log_file VARCHAR(255),
                tags JSON,
                position INT DEFAULT 0,
                external_link TEXT,
                module_name VARCHAR(50),
                group_id INT,
                user_id INT,
                cost_estimate INT DEFAULT 0
            )
        `);

        // --- USERS TABLE ---
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role ENUM('user', 'moderator', 'admin') DEFAULT 'user',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                full_name VARCHAR(255),
                cpf VARCHAR(20),
                cnpj VARCHAR(20),
                current_credits INT DEFAULT 0
            )
        `);

        // --- GROUPS TABLE ---
        await pool.query(`
            CREATE TABLE IF NOT EXISTS groups (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // --- USER_GROUPS TABLE ---
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_groups (
                user_id INT NOT NULL,
                group_id INT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, group_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
            )
        `);

        // --- CREDITS LEDGER TABLE ---
        await pool.query(`
            CREATE TABLE IF NOT EXISTS credits_ledger (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                amount INT NOT NULL,
                reason VARCHAR(255),
                task_id VARCHAR(36),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // --- TASK ITEMS TABLE ---
        await pool.query(`
            CREATE TABLE IF NOT EXISTS task_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                task_id VARCHAR(36) NOT NULL,
                original_id VARCHAR(50),
                description TEXT,
                max_price DECIMAL(10, 2),
                quantity INT,
                status VARCHAR(50) DEFAULT 'pending',
                is_unlocked BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            )
        `);

        // --- ITEM CANDIDATES TABLE ---
        await pool.query(`
            CREATE TABLE IF NOT EXISTS item_candidates (
                id INT AUTO_INCREMENT PRIMARY KEY,
                task_item_id INT NOT NULL,
                title VARCHAR(255),
                price DECIMAL(10, 2),
                link TEXT,
                image_url TEXT,
                store VARCHAR(100),
                specs JSON,
                risk_score VARCHAR(50),
                ai_reasoning TEXT,
                is_selected BOOLEAN DEFAULT FALSE,
                gtin VARCHAR(50),
                manufacturer_part_number VARCHAR(100),
                enrichment_source VARCHAR(50),
                seller_reputation VARCHAR(50),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_item_id) REFERENCES task_items(id) ON DELETE CASCADE
            )
        `);

        // --- TASK LOGS TABLE ---
        await pool.query(`
            CREATE TABLE IF NOT EXISTS task_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                task_id VARCHAR(36) NOT NULL,
                message TEXT,
                level VARCHAR(20) DEFAULT 'info',
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            )
        `);

        // --- TASK METADATA TABLE ---
        await pool.query(`
            CREATE TABLE IF NOT EXISTS task_metadata (
                id INT AUTO_INCREMENT PRIMARY KEY,
                task_id VARCHAR(36) NOT NULL,
                data JSON,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            )
        `);

        // --- OPPORTUNITIES (ORACLE/RADAR) TABLE ---
        await pool.query(`
            CREATE TABLE IF NOT EXISTS opportunities (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT, -- Null for Admin/Radar, Set for User History
                title VARCHAR(255),
                municipality VARCHAR(255),
                metadata_json JSON, -- The Public Teaser
                locked_content_json JSON, -- The Private Analysis
                items_json JSON, -- Extracted Items for Sniper
                ipm_score INT DEFAULT 0,
                status VARCHAR(50) DEFAULT 'available', -- available, unlocked, archived
                unlocked_modules JSON, -- List of bought module keys
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // --- SETTINGS TABLE ---
        await pool.query(`
            CREATE TABLE IF NOT EXISTS settings (
                setting_key VARCHAR(100) PRIMARY KEY,
                setting_value TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // --- NOTIFICATIONS TABLE ---
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                title VARCHAR(255),
                message TEXT,
                link VARCHAR(255),
                is_read BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // --- LICITACOES TABLES (PNCP MODULE) ---
        await pool.query(`
            CREATE TABLE IF NOT EXISTS licitacoes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                
                -- Identificadores PNCP
                numero_sequencial_pncp VARCHAR(100) NOT NULL UNIQUE,
                numero_controle_pncp VARCHAR(255),
                ano_compra INT,
                
                -- Dados do Órgão
                cnpj_orgao VARCHAR(18),
                razao_social_orgao VARCHAR(500),
                poder VARCHAR(50),
                esfera VARCHAR(50),
                
                -- Dados da Licitação
                objeto_compra TEXT,
                informacao_complementar TEXT,
                situacao_compra VARCHAR(100),
                modalidade_licitacao VARCHAR(100),
                modo_disputa VARCHAR(100),
                criterio_julgamento VARCHAR(100),
                
                -- Valores
                valor_estimado_total DECIMAL(15, 2),
                valor_total_homologado DECIMAL(15, 2),
                
                -- Datas
                data_publicacao_pncp DATETIME,
                data_abertura_proposta DATETIME,
                data_encerramento_proposta DATETIME,
                
                -- Dados completos em JSON (Event Sourcing)
                raw_data_json JSON,
                
                -- Controle interno
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX idx_cnpj (cnpj_orgao),
                INDEX idx_data_pub (data_publicacao_pncp),
                INDEX idx_situacao (situacao_compra),
                INDEX idx_modalidade (modalidade_licitacao),
                FULLTEXT INDEX ft_objeto (objeto_compra, informacao_complementar)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS licitacoes_itens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                licitacao_id INT NOT NULL,
                
                numero_item INT,
                descricao_item TEXT,
                quantidade DECIMAL(12, 4),
                unidade_medida VARCHAR(50),
                valor_unitario_estimado DECIMAL(15, 4),
                valor_total_estimado DECIMAL(15, 2),
                
                -- Classificação
                codigo_catmat VARCHAR(50),
                descricao_catmat VARCHAR(500),
                
                situacao_item VARCHAR(100),
                
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (licitacao_id) REFERENCES licitacoes(id) ON DELETE CASCADE,
                INDEX idx_licitacao (licitacao_id)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS licitacoes_sync_control (
                id INT AUTO_INCREMENT PRIMARY KEY,
                
                sync_type VARCHAR(50),
                status VARCHAR(50),
                
                -- Parâmetros da busca
                data_inicial DATE,
                data_final DATE,
                cnpj_orgao VARCHAR(18),
                
                -- Controle paginação
                total_pages INT,
                current_page INT DEFAULT 1,
                items_per_page INT DEFAULT 500,
                
                -- Resultados
                total_imported INT DEFAULT 0,
                total_duplicates INT DEFAULT 0,
                total_errors INT DEFAULT 0,
                
                error_message TEXT,
                
                started_at DATETIME,
                finished_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // --- LICITACOES ARQUIVOS TABLE (PDFs e anexos) ---
        await pool.query(`
            CREATE TABLE IF NOT EXISTS licitacoes_arquivos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                licitacao_id INT NOT NULL,
                sequencial_documento INT,
                titulo VARCHAR(500),
                tipo_documento_id INT,
                tipo_documento_nome VARCHAR(200),
                tipo_documento_descricao TEXT,
                url TEXT NOT NULL,
                data_publicacao DATETIME,
                status_ativo BOOLEAN DEFAULT TRUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (licitacao_id) REFERENCES licitacoes(id) ON DELETE CASCADE,
                INDEX idx_licitacao (licitacao_id),
                INDEX idx_tipo (tipo_documento_id)
            )
        `);

        // --- USER LICITACOES PREFERENCES TABLE ---
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_licitacoes_preferences (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                
                -- Palavras-chave (JSON array)
                keywords JSON,
                
                -- Localizações preferenciais
                preferred_ufs JSON,
                preferred_municipios JSON,
                
                -- Modalidades preferidas
                preferred_modalidades JSON,
                
                -- Faixas de valor
                min_value DECIMAL(15, 2),
                max_value DECIMAL(15, 2),
                
                -- Categorias (órgãos, esfera, poder)
                preferred_esferas JSON,
                preferred_poderes JSON,
                
                -- Configurações de visualização
                default_view_mode VARCHAR(20) DEFAULT 'story',
                cards_per_row INT DEFAULT 3,
                
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unique_user (user_id)
            )
        `);

        // --- USER SAVED LICITACOES TABLE (for favorites) ---
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_saved_licitacoes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                licitacao_id INT NOT NULL,
                saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                notes TEXT,
                
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (licitacao_id) REFERENCES licitacoes(id) ON DELETE CASCADE,
                UNIQUE KEY unique_save (user_id, licitacao_id)
            )
        `);

        console.log('[Database] ✅ Tables created/verified');

        // Check for default admin
        const [users] = await pool.query("SELECT * FROM users WHERE username = 'admin'");
        if (users.length === 0) {
            const hash = await bcrypt.hash('admin', 10);
            await pool.query("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", ['admin', hash, 'admin']);
            console.log('[Database] Default admin user created (admin/admin)');
        }

        // Migrations (Safe to run multiple times)
        // Note: Using loop with individual try-catch to ensure one failure doesn't stop others
        const migrations = [
            "ALTER TABLE tasks ADD COLUMN external_link TEXT",
            "ALTER TABLE tasks ADD COLUMN tags JSON",
            "ALTER TABLE tasks ADD COLUMN position INT DEFAULT 0",
            "ALTER TABLE tasks ADD COLUMN module_name VARCHAR(50)",
            "ALTER TABLE tasks ADD COLUMN group_id INT",
            "ALTER TABLE tasks ADD COLUMN user_id INT",
            "ALTER TABLE tasks ADD COLUMN cost_estimate INT DEFAULT 0",
            "ALTER TABLE users ADD COLUMN full_name VARCHAR(255)",
            "ALTER TABLE users ADD COLUMN cpf VARCHAR(20)",
            "ALTER TABLE users ADD COLUMN cnpj VARCHAR(20)",
            "ALTER TABLE users ADD COLUMN current_credits INT DEFAULT 0",
            "ALTER TABLE task_items ADD COLUMN is_unlocked BOOLEAN DEFAULT FALSE",
            "ALTER TABLE opportunities ADD COLUMN unlocked_modules JSON DEFAULT ('[]')",

            // Licitacoes module - Expansão completa do schema
            "ALTER TABLE licitacoes ADD COLUMN sequencial_compra INT",
            "ALTER TABLE licitacoes ADD COLUMN numero_compra VARCHAR(100)",
            "ALTER TABLE licitacoes ADD COLUMN processo VARCHAR(255)",
            "ALTER TABLE licitacoes ADD COLUMN link_sistema_origem TEXT",
            "ALTER TABLE licitacoes ADD COLUMN link_processo_eletronico TEXT",
            "ALTER TABLE licitacoes ADD COLUMN data_inclusao DATETIME",
            "ALTER TABLE licitacoes ADD COLUMN data_atualizacao DATETIME",
            "ALTER TABLE licitacoes ADD COLUMN data_atualizacao_global DATETIME",
            "ALTER TABLE licitacoes ADD COLUMN modo_disputa_id INT",
            "ALTER TABLE licitacoes ADD COLUMN modo_disputa_nome VARCHAR(100)",
            "ALTER TABLE licitacoes ADD COLUMN tipo_instrumento_codigo INT",
            "ALTER TABLE licitacoes ADD COLUMN tipo_instrumento_nome VARCHAR(200)",
            "ALTER TABLE licitacoes ADD COLUMN srp BOOLEAN DEFAULT FALSE",
            "ALTER TABLE licitacoes ADD COLUMN usuario_nome VARCHAR(255)",
            "ALTER TABLE licitacoes ADD COLUMN uf_sigla CHAR(2)",
            "ALTER TABLE licitacoes ADD COLUMN uf_nome VARCHAR(100)",
            "ALTER TABLE licitacoes ADD COLUMN municipio_nome VARCHAR(200)",
            "ALTER TABLE licitacoes ADD COLUMN codigo_ibge VARCHAR(20)",
            "ALTER TABLE licitacoes ADD COLUMN codigo_unidade VARCHAR(50)",
            "ALTER TABLE licitacoes ADD COLUMN nome_unidade VARCHAR(255)",
            "ALTER TABLE licitacoes ADD COLUMN amparo_legal_codigo INT",
            "ALTER TABLE licitacoes ADD COLUMN amparo_legal_nome TEXT",
            "ALTER TABLE licitacoes ADD COLUMN amparo_legal_descricao TEXT",
            "ALTER TABLE licitacoes ADD COLUMN metadata_json JSON",
            "ALTER TABLE licitacoes_itens ADD COLUMN material_ou_servico CHAR(1)",
            "ALTER TABLE licitacoes_itens ADD COLUMN material_ou_servico_nome VARCHAR(50)"
        ];

        for (const sql of migrations) {
            try { await pool.query(sql); } catch (e) {
                // Ignore "duplicate column" errors
            }
        }

    } catch (e) {
        console.error('[Database] ❌ Connection/Init failed:', e.message);
    }
}

async function getPool() {
    if (!pool) await initDB();
    return pool;
}

// --- USER FUNCTIONS ---
async function getUserByUsername(username) {
    const p = await getPool();
    if (!p) return null;
    const [rows] = await p.query("SELECT * FROM users WHERE username = ?", [username]);
    return rows[0];
}

async function getUserById(id) {
    const p = await getPool();
    if (!p) return null;
    const [rows] = await p.query("SELECT * FROM users WHERE id = ?", [id]);
    return rows[0];
}

async function createUser(userData) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");
    const { username, password, role, full_name, cpf, cnpj } = userData;
    const hash = await bcrypt.hash(password, 10);
    await p.query(
        "INSERT INTO users (username, password_hash, role, full_name, cpf, cnpj, current_credits) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [username, hash, role || 'user', full_name, cpf, cnpj, 500]
    );
}

async function getAllUsers() {
    const p = await getPool();
    if (!p) return [];
    const [rows] = await p.query("SELECT id, username, role, created_at, full_name, current_credits FROM users");
    return rows;
}

async function deleteUser(id) {
    const p = await getPool();
    if (!p) return;
    await p.query("DELETE FROM users WHERE id = ?", [id]);
}

async function updateUserRole(id, role) {
    const p = await getPool();
    if (!p) return;
    await p.query("UPDATE users SET role = ? WHERE id = ?", [role, id]);
}


// --- GROUP & CREDIT FUNCTIONS ---

async function createGroup(name, description) {
    const p = await getPool();
    if (!p) return;
    await p.query("INSERT INTO groups (name, description) VALUES (?, ?)", [name, description]);
}

async function getAllGroups() {
    const p = await getPool();
    if (!p) return [];
    const [rows] = await p.query("SELECT * FROM groups ORDER BY name ASC");
    return rows;
}

async function getUserGroups(userId) {
    const p = await getPool();
    if (!p) return [];
    const [rows] = await p.query(`
        SELECT g.*
        FROM groups g
        JOIN user_groups ug ON g.id = ug.group_id
        WHERE ug.user_id = ?
    `, [userId]);
    return rows;
}

async function addUserToGroup(userId, groupId) {
    const p = await getPool();
    if (!p) return;
    try {
        await p.query("INSERT INTO user_groups (user_id, group_id) VALUES (?, ?)", [userId, groupId]);
    } catch (e) {
        // Ignore duplicates
    }
}

async function removeUserFromGroup(userId, groupId) {
    const p = await getPool();
    if (!p) return;
    await p.query("DELETE FROM user_groups WHERE user_id = ? AND group_id = ?", [userId, groupId]);
}

async function addCredits(userId, amount, reason, taskId = null) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");

    const connection = await p.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Insert Ledger
        await connection.query(
            "INSERT INTO credits_ledger (user_id, amount, reason, task_id) VALUES (?, ?, ?, ?)",
            [userId, amount, reason, taskId]
        );

        // 2. Update User Balance
        await connection.query(
            "UPDATE users SET current_credits = current_credits + ? WHERE id = ?",
            [amount, userId]
        );

        await connection.commit();
    } catch (e) {
        await connection.rollback();
        throw e;
    } finally {
        connection.release();
    }
}

async function getUserCredits(userId) {
    const p = await getPool();
    if (!p) return 0;
    const [rows] = await p.query("SELECT current_credits FROM users WHERE id = ?", [userId]);
    return rows[0] ? rows[0].current_credits : 0;
}


// --- TASK FUNCTIONS ---
async function createTask(task) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");

    const [rows] = await p.query("SELECT MAX(position) as maxPos FROM tasks");
    const nextPos = (rows[0].maxPos || 0) + 1;

    const sql = `INSERT INTO tasks (id, name, status, cep, input_file, log_file, position, tags, external_link, module_name, group_id, user_id, cost_estimate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    await p.query(sql, [
        task.id,
        task.name,
        'pending',
        task.cep,
        task.input_file,
        task.log_file,
        nextPos,
        '[]',
        task.external_link || null,
        task.module_name || 'gemini_meli',
        task.group_id || null,
        task.user_id || null,
        task.cost_estimate || 0
    ]);
    return task.id;
}

async function updateTaskStatus(id, status, outputFile = null) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");

    let sql = `UPDATE tasks SET status = ? WHERE id = ?`;
    let params = [status, id];

    if (status === 'completed' || status === 'failed') {
        sql = `UPDATE tasks SET status = ?, finished_at = NOW(), output_file = ? WHERE id = ?`;
        params = [status, outputFile, id];
    } else if (status === 'aborted') {
        sql = `UPDATE tasks SET status = ?, finished_at = NOW() WHERE id = ?`;
        params = [status, id];
    }

    await p.query(sql, params);
}

// Updated getTasks to support scoping
async function getTasksForUser(user, showArchived = false, limit = 100, offset = 0) {
    const p = await getPool();
    if (!p) return [];

    let statusSql = "status != 'archived'";
    if (showArchived) statusSql = "status = 'archived'";

    // Safe params
    limit = parseInt(limit) || 100;
    offset = parseInt(offset) || 0;

    if (user.role === 'admin') {
        // Admin sees all
        const sql = `SELECT * FROM tasks WHERE ${statusSql} ORDER BY position ASC, created_at DESC LIMIT ? OFFSET ?`;
        const [rows] = await p.query(sql, [limit, offset]);
        return rows;
    } else {
        // User sees tasks from their groups OR their own tasks
        // Get user groups
        const userGroups = await getUserGroups(user.id);
        const groupIds = userGroups.map(g => g.id);

        let whereClause = `(${statusSql}) AND (user_id = ?`;
        if (groupIds.length > 0) {
            whereClause += ` OR group_id IN (${groupIds.join(',')})`; // Safe int join
        }
        whereClause += `)`;

        const sql = `SELECT * FROM tasks WHERE ${whereClause} ORDER BY position ASC, created_at DESC LIMIT ? OFFSET ?`;
        const [rows] = await p.query(sql, [user.id, limit, offset]);
        return rows;
    }
}

async function getTasks(showArchived = false) {
    // Legacy/Internal use
    const p = await getPool();
    if (!p) return [];

    let sql = "SELECT * FROM tasks WHERE status != 'archived' ORDER BY position ASC, created_at DESC";
    if (showArchived) {
        sql = "SELECT * FROM tasks WHERE status = 'archived' ORDER BY finished_at DESC";
    }

    const [rows] = await p.query(sql);
    return rows;
}

async function getTaskById(id) {
    const p = await getPool();
    if (!p) return null;

    const [rows] = await p.query("SELECT * FROM tasks WHERE id = ?", [id]);
    return rows[0];
}

async function updateTaskPosition(id, position) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");
    await p.query("UPDATE tasks SET position = ? WHERE id = ?", [position, id]);
}

async function updateTaskTags(id, tags) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");
    const tagsStr = typeof tags === 'string' ? tags : JSON.stringify(tags);
    await p.query("UPDATE tasks SET tags = ? WHERE id = ?", [tagsStr, id]);
}

async function getNextPendingTask() {
    const p = await getPool();
    if (!p) return null;

    const [rows] = await p.query("SELECT * FROM tasks WHERE status = 'pending' ORDER BY position ASC LIMIT 1");
    return rows[0];
}

async function forceStartTask(id) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");
    await p.query("UPDATE tasks SET status = 'pending', position = -1 WHERE id = ?", [id]);
}

// --- NEW DB PERSISTENCE FUNCTIONS ---

async function createTaskItems(taskId, items) {
    const p = await getPool();
    if (!p) return;
    // items: array of { id, description, valor_venda, quantidade }
    const values = items.map(i => [
        taskId,
        i.ID || i.id,
        i.Descricao || i.description || i.Description,
        i.valor_venda,
        i.quantidade
    ]);

    if (values.length === 0) return;

    const sql = `INSERT INTO task_items (task_id, original_id, description, max_price, quantity) VALUES ?`;
    await p.query(sql, [values]);
}

async function getTaskItem(taskId, originalId) {
    const p = await getPool();
    const [rows] = await p.query("SELECT * FROM task_items WHERE task_id = ? AND original_id = ?", [taskId, originalId]);
    return rows[0];
}

async function getTaskItems(taskId) {
    const p = await getPool();
    if (!p) return [];
    const [rows] = await p.query("SELECT * FROM task_items WHERE task_id = ? ORDER BY id ASC", [taskId]);
    return rows;
}

async function saveCandidates(taskItemId, candidates, selectedIndex) {
    const p = await getPool();
    if (!p || !taskItemId) return;
    if (!candidates || candidates.length === 0) return;

    const values = candidates.map((c, index) => [
        taskItemId,
        c.title || c.name || 'N/A',
        c.totalPrice || c.price || 0,
        c.link,
        c.image || c.thumbnail || null,
        c.store || 'N/A',
        JSON.stringify(c.specs || {}),
        c.risk_score || '-',
        c.aiReasoning || c.reasoning || '-',
        index === selectedIndex, // is_selected
        c.gtin || null,
        c.mpn || null,
        c.enrichment_source || null,
        c.seller_reputation || null
    ]);

    const sql = `INSERT INTO item_candidates (task_item_id, title, price, link, image_url, store, specs, risk_score, ai_reasoning, is_selected, gtin, manufacturer_part_number, enrichment_source, seller_reputation) VALUES ?`;
    await p.query(sql, [values]);

    // Update item status
    await p.query("UPDATE task_items SET status = 'done' WHERE id = ?", [taskItemId]);
}

async function logTaskMessage(taskId, message, level = 'info') {
    const p = await getPool();
    if (!p) return;
    try {
        await p.query("INSERT INTO task_logs (task_id, message, level) VALUES (?, ?, ?)", [taskId, message, level]);
    } catch (e) {
        console.error("Failed to log to DB:", e);
    }
}

async function getTaskLogs(taskId) {
    const p = await getPool();
    if (!p) return [];
    const [rows] = await p.query("SELECT * FROM task_logs WHERE task_id = ? ORDER BY timestamp ASC", [taskId]);
    return rows;
}

// Fetch Full Results for Excel Generation
async function createTaskMetadata(taskId, data) {
    const p = await getPool();
    if (!p) return;
    try {
        await p.query("INSERT INTO task_metadata (task_id, data) VALUES (?, ?)", [taskId, JSON.stringify(data)]);
    } catch (e) {
        console.error("Failed to save metadata:", e);
    }
}

async function getTaskFullResults(taskId) {
    const p = await getPool();
    if (!p) return [];

    // Get Items
    const [items] = await p.query("SELECT * FROM task_items WHERE task_id = ?", [taskId]);

    // For each item, get candidates
    const results = [];
    for (const item of items) {
        const [candidates] = await p.query("SELECT * FROM item_candidates WHERE task_item_id = ?", [item.id]);

        const offers = candidates.map(c => ({
            title: c.title,
            totalPrice: parseFloat(c.price),
            link: c.link,
            image: c.image_url,
            store: c.store,
            specs: typeof c.specs === 'string' ? JSON.parse(c.specs) : c.specs,
            risk_score: c.risk_score,
            aiReasoning: c.ai_reasoning,
            brand_model: c.title
        }));

        const winnerIndex = candidates.findIndex(c => c.is_selected);

        results.push({
            id: item.original_id,
            db_id: item.id, // Internal ID for unlocking
            is_unlocked: item.is_unlocked,
            description: item.description,
            valor_venda: parseFloat(item.max_price),
            quantidade: item.quantity,
            offers: offers,
            winnerIndex: winnerIndex
        });
    }

    // Sort by ID to maintain order
    results.sort((a, b) => parseInt(a.id) - parseInt(b.id));
    return results;
}

async function getTaskMetadata(taskId) {
    const p = await getPool();
    if (!p) return null;
    const [rows] = await p.query("SELECT * FROM task_metadata WHERE task_id = ?", [taskId]);
    return rows[0];
}

async function updateTaskItemLockStatus(itemId, isUnlocked) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");
    await p.query("UPDATE task_items SET is_unlocked = ? WHERE id = ?", [isUnlocked, itemId]);
}

async function unlockAllTaskItems(taskId) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");
    await p.query("UPDATE task_items SET is_unlocked = TRUE WHERE task_id = ?", [taskId]);
}

// --- OPPORTUNITIES (RADAR/ORACLE) FUNCTIONS ---

async function createOpportunity(userId, data) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");

    // data expects: { title, municipality, metadata, locked_content, items, ipm_score }
    const sql = `INSERT INTO opportunities
        (user_id, title, municipality, metadata_json, locked_content_json, items_json, ipm_score, unlocked_modules)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

    const [result] = await p.query(sql, [
        userId || null, // If null, it's global/radar
        data.title,
        data.municipality,
        JSON.stringify(data.metadata),
        JSON.stringify(data.locked_content),
        JSON.stringify(data.items),
        data.ipm_score || 0,
        JSON.stringify([]) // unlocked_modules starts empty
    ]);
    return result.insertId;
}

async function getRadarOpportunities() {
    const p = await getPool();
    if (!p) return [];
    // Where user_id is NULL (Admin/System generated)
    const [rows] = await p.query("SELECT * FROM opportunities WHERE user_id IS NULL ORDER BY created_at DESC");
    return rows;
}

async function getUserOpportunities(userId) {
    const p = await getPool();
    if (!p) return [];
    const [rows] = await p.query("SELECT * FROM opportunities WHERE user_id = ? ORDER BY created_at DESC", [userId]);
    return rows;
}

async function getOpportunityById(id) {
    const p = await getPool();
    if (!p) return null;
    const [rows] = await p.query("SELECT * FROM opportunities WHERE id = ?", [id]);
    return rows[0];
}

// --- SETTINGS FUNCTIONS ---
async function getSetting(key) {
    const p = await getPool();
    if (!p) return null;
    const [rows] = await p.query("SELECT setting_value FROM settings WHERE setting_key = ?", [key]);
    return rows[0] ? rows[0].setting_value : null;
}

async function unlockOpportunityModule(opportunityId, moduleKey) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");

    // Get current unlocked modules
    const opp = await getOpportunityById(opportunityId);
    if (!opp) throw new Error("Analysis not found");

    let current = typeof opp.unlocked_modules === 'string'
        ? JSON.parse(opp.unlocked_modules || '[]')
        : (opp.unlocked_modules || []);

    if (!Array.isArray(current)) current = [];

    if (!current.includes(moduleKey)) {
        current.push(moduleKey);
        await p.query("UPDATE opportunities SET unlocked_modules = ? WHERE id = ?", [JSON.stringify(current), opportunityId]);
    }
}

async function setSetting(key, value) {
    const p = await getPool();
    if (!p) return;
    await p.query(`
        INSERT INTO settings (setting_key, setting_value)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE setting_value = ?
    `, [key, value, value]);
}

// --- NOTIFICATION FUNCTIONS ---
async function createNotification(userId, title, message, link) {
    const p = await getPool();
    if (!p) return;
    await p.query("INSERT INTO notifications (user_id, title, message, link) VALUES (?, ?, ?, ?)", [userId, title, message, link]);
}

async function getUnreadNotifications(userId) {
    const p = await getPool();
    if (!p) return [];
    const [rows] = await p.query("SELECT * FROM notifications WHERE user_id = ? AND is_read = FALSE ORDER BY created_at DESC", [userId]);
    return rows;
}

async function markNotificationAsRead(id) {
    const p = await getPool();
    if (!p) return;
    await p.query("UPDATE notifications SET is_read = TRUE WHERE id = ?", [id]);
}

// --- LICITACOES FUNCTIONS ---

async function createLicitacao(data) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");

    const sql = `INSERT INTO licitacoes (
        numero_sequencial_pncp, numero_controle_pncp, ano_compra, sequencial_compra, numero_compra, processo,
        cnpj_orgao, razao_social_orgao, poder, esfera,
        objeto_compra, informacao_complementar, situacao_compra,
        modalidade_licitacao, modo_disputa, modo_disputa_id, modo_disputa_nome, criterio_julgamento,
        tipo_instrumento_codigo, tipo_instrumento_nome,
        valor_estimado_total, valor_total_homologado,
        data_publicacao_pncp, data_abertura_proposta, data_encerramento_proposta,
        data_inclusao, data_atualizacao, data_atualizacao_global,
        link_sistema_origem, link_processo_eletronico,
        srp, usuario_nome,
        uf_sigla, uf_nome, municipio_nome, codigo_ibge, codigo_unidade, nome_unidade,
        amparo_legal_codigo, amparo_legal_nome, amparo_legal_descricao,
        raw_data_json, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const [result] = await p.query(sql, [
        data.numeroSequencial,
        data.numeroControle,
        data.anoCompra,
        data.sequencialCompra,
        data.numeroCompra,
        data.processo,
        data.cnpjOrgao,
        data.razaoSocialOrgao,
        data.poder,
        data.esfera,
        data.objetoCompra,
        data.informacaoComplementar,
        data.situacaoCompra,
        data.modalidadeLicitacao,
        data.modoDisputa,
        data.modoDisputaId,
        data.modoDisputaNome,
        data.criterioJulgamento,
        data.tipoInstrumentoCodigo,
        data.tipoInstrumentoNome,
        data.valorEstimadoTotal,
        data.valorTotalHomologado,
        data.dataPublicacaoPncp,
        data.dataAberturaProposta,
        data.dataEncerramentoProposta,
        data.dataInclusao,
        data.dataAtualizacao,
        data.dataAtualizacaoGlobal,
        data.linkSistemaOrigem,
        data.linkProcessoEletronico,
        data.srp ? 1 : 0,
        data.usuarioNome,
        data.ufSigla,
        data.ufNome,
        data.municipioNome,
        data.codigoIbge,
        data.codigoUnidade,
        data.nomeUnidade,
        data.amparoLegalCodigo,
        data.amparoLegalNome,
        data.amparoLegalDescricao,
        JSON.stringify(data.rawData || {}),
        JSON.stringify(data.metadata || {})
    ]);

    return result.insertId;
}

async function getLicitacoes(filters = {}, limit = 50, offset = 0) {
    const p = await getPool();
    if (!p) return [];

    let sql = 'SELECT * FROM licitacoes WHERE 1=1';
    const params = [];

    if (filters.cnpj_orgao) {
        sql += ' AND cnpj_orgao = ?';
        params.push(filters.cnpj_orgao);
    }

    if (filters.modalidade) {
        sql += ' AND modalidade_licitacao = ?';
        params.push(filters.modalidade);
    }

    if (filters.search) {
        sql += ' AND MATCH(objeto_compra, informacao_complementar) AGAINST(? IN NATURAL LANGUAGE MODE)';
        params.push(filters.search);
    }

    sql += ' ORDER BY data_publicacao_pncp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await p.query(sql, params);
    return rows;
}

async function getLicitacaoById(id) {
    const p = await getPool();
    if (!p) return null;
    const [rows] = await p.query('SELECT * FROM licitacoes WHERE id = ?', [id]);
    return rows[0];
}

async function createLicitacaoArquivo(licitacaoId, data) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");

    const sql = `INSERT INTO licitacoes_arquivos (
        licitacao_id, sequencial_documento, titulo, 
        tipo_documento_id, tipo_documento_nome, tipo_documento_descricao,
        url, data_publicacao, status_ativo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const [result] = await p.query(sql, [
        licitacaoId,
        data.sequencialDocumento,
        data.titulo,
        data.tipoDocumentoId,
        data.tipoDocumentoNome,
        data.tipoDocumentoDescricao,
        data.url,
        data.dataPublicacao,
        data.statusAtivo ? 1 : 0
    ]);

    return result.insertId;
}

async function getLicitacaoArquivos(licitacaoId) {
    const p = await getPool();
    if (!p) return [];

    const [rows] = await p.query(
        'SELECT * FROM licitacoes_arquivos WHERE licitacao_id = ? AND status_ativo = TRUE ORDER BY sequencial_documento',
        [licitacaoId]
    );
    return rows;
}

async function getLicitacaoItens(licitacaoId) {
    const p = await getPool();
    if (!p) return [];
    const [rows] = await p.query(
        'SELECT * FROM licitacoes_itens WHERE licitacao_id = ? ORDER BY numero_item ASC',
        [licitacaoId]
    );
    return rows;
}

async function createLicitacaoItem(licitacaoId, itemData) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");

    const sql = `INSERT INTO licitacoes_itens (
        licitacao_id, numero_item, descricao_item, quantidade,
        unidade_medida, valor_unitario_estimado, valor_total_estimado,
        codigo_catmat, descricao_catmat, situacao_item
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const [result] = await p.query(sql, [
        licitacaoId,
        itemData.numeroItem,
        itemData.descricaoItem,
        itemData.quantidade,
        itemData.unidadeMedida,
        itemData.valorUnitarioEstimado,
        itemData.valorTotalEstimado,
        itemData.codigoCatmat,
        itemData.descricaoCatmat,
        itemData.situacaoItem
    ]);

    return result.insertId;
}

async function createSyncControl(params) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");

    const sql = `INSERT INTO licitacoes_sync_control 
        (sync_type, status, data_inicial, data_final, cnpj_orgao, total_pages, items_per_page, started_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`;

    const [result] = await p.query(sql, [
        params.syncType,
        'running',
        params.dataInicial,
        params.dataFinal,
        params.cnpjOrgao || null,
        params.totalPages || 0,
        params.itemsPerPage || 500
    ]);

    return result.insertId;
}

async function updateSyncControl(id, updates) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");

    const fields = [];
    const values = [];

    if (updates.status) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.current_page) { fields.push('current_page = ?'); values.push(updates.current_page); }
    if (updates.total_imported !== undefined) { fields.push('total_imported = ?'); values.push(updates.total_imported); }
    if (updates.total_duplicates !== undefined) { fields.push('total_duplicates = ?'); values.push(updates.total_duplicates); }
    if (updates.total_errors !== undefined) { fields.push('total_errors = ?'); values.push(updates.total_errors); }
    if (updates.error_message) { fields.push('error_message = ?'); values.push(updates.error_message); }
    if (updates.finished_at) { fields.push('finished_at = NOW()'); }

    if (fields.length === 0) return;

    values.push(id);

    const sql = `UPDATE licitacoes_sync_control SET ${fields.join(', ')} WHERE id = ?`;
    await p.query(sql, values);
}

async function getActiveSyncControl() {
    const p = await getPool();
    if (!p) return null;
    const [rows] = await p.query(
        "SELECT * FROM licitacoes_sync_control WHERE status = 'running' ORDER BY started_at DESC LIMIT 1"
    );
    return rows[0];
}

async function getLatestSyncControl() {
    const p = await getPool();
    if (!p) return null;
    const [rows] = await p.query(
        "SELECT * FROM licitacoes_sync_control ORDER BY created_at DESC LIMIT 1"
    );
    return rows[0];
}

// --- USER LICITACOES PREFERENCES FUNCTIONS ---

async function getUserLicitacoesPreferences(userId) {
    const p = await getPool();
    if (!p) return null;

    const [rows] = await p.query(
        'SELECT * FROM user_licitacoes_preferences WHERE user_id = ?',
        [userId]
    );

    if (rows.length === 0) {
        // Return default preferences if none exist
        return {
            user_id: userId,
            keywords: [],
            preferred_ufs: [],
            preferred_municipios: [],
            preferred_modalidades: [],
            min_value: 0,
            max_value: 999999999,
            preferred_esferas: [],
            preferred_poderes: [],
            default_view_mode: 'story',
            cards_per_row: 3
        };
    }

    const prefs = rows[0];
    // Parse JSON fields
    if (typeof prefs.keywords === 'string') prefs.keywords = JSON.parse(prefs.keywords || '[]');
    if (typeof prefs.preferred_ufs === 'string') prefs.preferred_ufs = JSON.parse(prefs.preferred_ufs || '[]');
    if (typeof prefs.preferred_municipios === 'string') prefs.preferred_municipios = JSON.parse(prefs.preferred_municipios || '[]');
    if (typeof prefs.preferred_modalidades === 'string') prefs.preferred_modalidades = JSON.parse(prefs.preferred_modalidades || '[]');
    if (typeof prefs.preferred_esferas === 'string') prefs.preferred_esferas = JSON.parse(prefs.preferred_esferas || '[]');
    if (typeof prefs.preferred_poderes === 'string') prefs.preferred_poderes = JSON.parse(prefs.preferred_poderes || '[]');

    return prefs;
}

async function updateUserLicitacoesPreferences(userId, preferences) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");

    // Check if preferences exist
    const existing = await getUserLicitacoesPreferences(userId);

    const data = {
        keywords: JSON.stringify(preferences.keywords || []),
        preferred_ufs: JSON.stringify(preferences.preferred_ufs || []),
        preferred_municipios: JSON.stringify(preferences.preferred_municipios || []),
        preferred_modalidades: JSON.stringify(preferences.preferred_modalidades || []),
        min_value: preferences.min_value || 0,
        max_value: preferences.max_value || 999999999,
        preferred_esferas: JSON.stringify(preferences.preferred_esferas || []),
        preferred_poderes: JSON.stringify(preferences.preferred_poderes || []),
        default_view_mode: preferences.default_view_mode || 'story',
        cards_per_row: preferences.cards_per_row || 3
    };

    if (existing && existing.id) {
        // Update existing
        await p.query(
            `UPDATE user_licitacoes_preferences 
             SET keywords = ?, preferred_ufs = ?, preferred_municipios = ?, 
                 preferred_modalidades = ?, min_value = ?, max_value = ?,
                 preferred_esferas = ?, preferred_poderes = ?,
                 default_view_mode = ?, cards_per_row = ?
             WHERE user_id = ?`,
            [
                data.keywords, data.preferred_ufs, data.preferred_municipios,
                data.preferred_modalidades, data.min_value, data.max_value,
                data.preferred_esferas, data.preferred_poderes,
                data.default_view_mode, data.cards_per_row,
                userId
            ]
        );
    } else {
        // Insert new
        await p.query(
            `INSERT INTO user_licitacoes_preferences 
             (user_id, keywords, preferred_ufs, preferred_municipios, 
              preferred_modalidades, min_value, max_value,
              preferred_esferas, preferred_poderes, default_view_mode, cards_per_row)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                data.keywords, data.preferred_ufs, data.preferred_municipios,
                data.preferred_modalidades, data.min_value, data.max_value,
                data.preferred_esferas, data.preferred_poderes,
                data.default_view_mode, data.cards_per_row
            ]
        );
    }
}

async function getPersonalizedLicitacoes(userId, filters = {}, limit = 50, offset = 0) {
    const p = await getPool();
    if (!p) return [];

    // Get user preferences
    const prefs = await getUserLicitacoesPreferences(userId);

    // Build base query with scoring
    let sql = `
        SELECT l.*,
        (
            -- KEYWORD MATCH (40 points max)
            ${prefs.keywords.length > 0 ? `
            (
                ${prefs.keywords.map((kw, idx) =>
        `(CASE WHEN LOWER(l.objeto_compra) LIKE ? THEN 10 ELSE 0 END)`
    ).join(' + ')}
            )
            ` : '0'}
            +
            -- LOCATION MATCH (30 points)
            (CASE 
                ${prefs.preferred_ufs.length > 0 ?
            `WHEN l.uf_sigla IN (${prefs.preferred_ufs.map(() => '?').join(',')}) THEN 30`
            : 'WHEN 1=0 THEN 30'}
                ELSE 0 
            END)
            +
            -- MODALIDADE MATCH (20 points)
            (CASE 
                ${prefs.preferred_modalidades.length > 0 ?
            `WHEN l.modalidade_licitacao IN (${prefs.preferred_modalidades.map(() => '?').join(',')}) THEN 20`
            : 'WHEN 1=0 THEN 20'}
                ELSE 0 
            END)
            +
            -- VALUE RANGE (10 points)
            (CASE 
                WHEN l.valor_estimado_total BETWEEN ? AND ? THEN 10
                ELSE 0 
            END)
        ) AS relevance_score
        FROM licitacoes l
        WHERE 1=1
    `;

    const params = [];

    // Add keyword params (for LIKE matching)
    prefs.keywords.forEach(kw => {
        params.push(`%${kw.toLowerCase()}%`);
    });

    // Add UF params
    prefs.preferred_ufs.forEach(uf => {
        params.push(uf);
    });

    // Add modalidade params
    prefs.preferred_modalidades.forEach(mod => {
        params.push(mod);
    });

    // Add value range params
    params.push(prefs.min_value || 0, prefs.max_value || 999999999);

    // Apply additional filters from request
    if (filters.cnpj_orgao) {
        sql += ' AND l.cnpj_orgao = ?';
        params.push(filters.cnpj_orgao);
    }

    if (filters.modalidade) {
        sql += ' AND l.modalidade_licitacao = ?';
        params.push(filters.modalidade);
    }

    if (filters.search) {
        sql += ' AND MATCH(l.objeto_compra, l.informacao_complementar) AGAINST(? IN NATURAL LANGUAGE MODE)';
        params.push(filters.search);
    }

    // Order by relevance score DESC, then by date
    sql += ' ORDER BY relevance_score DESC, l.data_publicacao_pncp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await p.query(sql, params);

    // Add matched keywords to each row for highlighting
    rows.forEach(row => {
        const matchedKeywords = prefs.keywords.filter(kw =>
            row.objeto_compra && row.objeto_compra.toLowerCase().includes(kw.toLowerCase())
        );
        row.matched_keywords = matchedKeywords.join(',');
    });

    return rows;
}

// --- USER SAVED LICITACOES FUNCTIONS ---

async function saveUserLicitacao(userId, licitacaoId, notes = null) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");

    try {
        await p.query(
            'INSERT INTO user_saved_licitacoes (user_id, licitacao_id, notes) VALUES (?, ?, ?)',
            [userId, licitacaoId, notes]
        );
        return true;
    } catch (e) {
        // Ignore duplicate key errors
        if (e.code === 'ER_DUP_ENTRY') return false;
        throw e;
    }
}

async function unsaveUserLicitacao(userId, licitacaoId) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");

    await p.query(
        'DELETE FROM user_saved_licitacoes WHERE user_id = ? AND licitacao_id = ?',
        [userId, licitacaoId]
    );
}

async function getUserSavedLicitacoes(userId, limit = 50, offset = 0) {
    const p = await getPool();
    if (!p) return [];

    const [rows] = await p.query(
        `SELECT l.*, s.saved_at, s.notes, 0 AS relevance_score
         FROM user_saved_licitacoes s
         JOIN licitacoes l ON s.licitacao_id = l.id
         WHERE s.user_id = ?
         ORDER BY s.saved_at DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset]
    );

    return rows;
}

async function isLicitacaoSaved(userId, licitacaoId) {
    const p = await getPool();
    if (!p) return false;

    const [rows] = await p.query(
        'SELECT id FROM user_saved_licitacoes WHERE user_id = ? AND licitacao_id = ?',
        [userId, licitacaoId]
    );

    return rows.length > 0;
}

module.exports = {
    initDB,
    createTask,
    updateTaskStatus,
    getTasks,
    getTasksForUser,
    getTaskById,
    updateTaskPosition,
    updateTaskTags,
    getNextPendingTask,
    forceStartTask,
    getUserByUsername,
    getUserById,
    createUser,
    getAllUsers,
    deleteUser,
    updateUserRole,
    createGroup,
    getAllGroups,
    getUserGroups,
    addUserToGroup,
    removeUserFromGroup,
    addCredits,
    getUserCredits,
    createTaskItems,
    getTaskItem,
    getTaskItems,
    saveCandidates,
    logTaskMessage,
    getTaskLogs,
    getTaskFullResults,
    createTaskMetadata,
    getTaskMetadata,
    updateTaskItemLockStatus,
    unlockAllTaskItems,
    createOpportunity,
    getRadarOpportunities,
    getUserOpportunities,
    getOpportunityById,
    unlockOpportunityModule,
    getSetting,
    setSetting,
    createNotification,
    getUnreadNotifications,
    markNotificationAsRead,
    // Licitações functions
    createLicitacao,
    getLicitacoes,
    getLicitacaoById,
    getLicitacaoItens,
    createLicitacaoItem,
    createLicitacaoArquivo,
    getLicitacaoArquivos,
    createSyncControl,
    updateSyncControl,
    getActiveSyncControl,
    getLatestSyncControl,
    // Preferences & Personalization
    getUserLicitacoesPreferences,
    updateUserLicitacoesPreferences,
    getPersonalizedLicitacoes,
    saveUserLicitacao,
    unsaveUserLicitacao,
    getUserSavedLicitacoes,
    isLicitacaoSaved
};


