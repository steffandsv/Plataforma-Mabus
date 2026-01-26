const { Pool } = require('pg');
const bcrypt = require('bcrypt');

let pool = null;

async function initDB() {
    if (pool) return;

    try {
        const config = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'mabus_admin',
            password: process.env.DB_PASS || 'Mabus_Secure_DB_2026_XyZ!',
            database: process.env.DB_DB || 'plataforma_mabus',
            port: process.env.DB_PORT || 5432,
            max: 10,
            idleTimeoutMillis: 30000,
        };

        pool = new Pool(config);

        // Verify connection
        const client = await pool.connect();
        console.log('[Database] ✅ Connected to PostgreSQL!');
        client.release();

        // Helper for function execution
        const query = async (text, params) => pool.query(text, params);

        // --- TRIGGER FOR UPDATED_AT ---
        await query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ language 'plpgsql';
        `);

        // --- TASKS TABLE ---
        await query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(255),
                status VARCHAR(50),
                cep VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                finished_at TIMESTAMP,
                input_file VARCHAR(255),
                output_file VARCHAR(255),
                log_file VARCHAR(255),
                tags JSONB,
                position INT DEFAULT 0,
                external_link TEXT,
                module_name VARCHAR(50),
                group_id INT,
                user_id INT,
                cost_estimate INT DEFAULT 0
            )
        `);

        // --- USERS TABLE ---
        await query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                full_name VARCHAR(255),
                cpf VARCHAR(20),
                cnpj VARCHAR(20),
                current_credits INT DEFAULT 0,
                CONSTRAINT check_role CHECK (role IN ('user', 'moderator', 'admin'))
            )
        `);

        // --- GROUPS TABLE ---
        await query(`
            CREATE TABLE IF NOT EXISTS groups (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // --- USER_GROUPS TABLE ---
        await query(`
            CREATE TABLE IF NOT EXISTS user_groups (
                user_id INT NOT NULL,
                group_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, group_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
            )
        `);

        // --- CREDITS LEDGER TABLE ---
        await query(`
            CREATE TABLE IF NOT EXISTS credits_ledger (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                amount INT NOT NULL,
                reason VARCHAR(255),
                task_id VARCHAR(36),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // --- TASK ITEMS TABLE ---
        await query(`
            CREATE TABLE IF NOT EXISTS task_items (
                id SERIAL PRIMARY KEY,
                task_id VARCHAR(36) NOT NULL,
                original_id VARCHAR(50),
                description TEXT,
                max_price DECIMAL(10, 2),
                quantity INT,
                status VARCHAR(50) DEFAULT 'pending',
                is_unlocked BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            )
        `);

        // --- ITEM CANDIDATES TABLE ---
        await query(`
            CREATE TABLE IF NOT EXISTS item_candidates (
                id SERIAL PRIMARY KEY,
                task_item_id INT NOT NULL,
                title VARCHAR(255),
                price DECIMAL(10, 2),
                link TEXT,
                image_url TEXT,
                store VARCHAR(100),
                specs JSONB,
                risk_score VARCHAR(50),
                ai_reasoning TEXT,
                is_selected BOOLEAN DEFAULT FALSE,
                gtin VARCHAR(50),
                manufacturer_part_number VARCHAR(100),
                enrichment_source VARCHAR(50),
                seller_reputation VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_item_id) REFERENCES task_items(id) ON DELETE CASCADE
            )
        `);

        // --- TASK LOGS TABLE ---
        await query(`
            CREATE TABLE IF NOT EXISTS task_logs (
                id SERIAL PRIMARY KEY,
                task_id VARCHAR(36) NOT NULL,
                message TEXT,
                level VARCHAR(20) DEFAULT 'info',
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            )
        `);

        // --- TASK METADATA TABLE ---
        await query(`
            CREATE TABLE IF NOT EXISTS task_metadata (
                id SERIAL PRIMARY KEY,
                task_id VARCHAR(36) NOT NULL,
                data JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            )
        `);

        // --- OPPORTUNITIES (ORACLE/RADAR) TABLE ---
        await query(`
            CREATE TABLE IF NOT EXISTS opportunities (
                id SERIAL PRIMARY KEY,
                user_id INT,
                title VARCHAR(255),
                municipality VARCHAR(255),
                metadata_json JSONB,
                locked_content_json JSONB,
                items_json JSONB,
                ipm_score INT DEFAULT 0,
                status VARCHAR(50) DEFAULT 'available',
                unlocked_modules JSONB DEFAULT '[]'::jsonb,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // --- SETTINGS TABLE ---
        await query(`
            CREATE TABLE IF NOT EXISTS settings (
                setting_key VARCHAR(100) PRIMARY KEY,
                setting_value TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        // Trigger for settings
        await query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_settings_updated_at') THEN
                    CREATE TRIGGER update_settings_updated_at
                    BEFORE UPDATE ON settings
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
                END IF;
            END $$;
        `);

        // --- NOTIFICATIONS TABLE ---
        await query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                title VARCHAR(255),
                message TEXT,
                link VARCHAR(255),
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // --- LICITACOES TABLES (PNCP MODULE) ---
        await query(`
            CREATE TABLE IF NOT EXISTS licitacoes (
                id SERIAL PRIMARY KEY,
                
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
                data_publicacao_pncp TIMESTAMP,
                data_abertura_proposta TIMESTAMP,
                data_encerramento_proposta TIMESTAMP,
                
                -- Dados completos em JSON (Event Sourcing)
                raw_data_json JSONB,
                
                raw_data_itens JSONB,
                raw_data_arquivos JSONB,
                
                -- Controle interno
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                -- Expanded Fields
                link_sistema_origem TEXT,
                link_processo_eletronico TEXT,
                sequencial_compra INT,
                data_inclusao TIMESTAMP,
                data_atualizacao TIMESTAMP,
                data_atualizacao_global TIMESTAMP,
                modo_disputa_id INT,
                modo_disputa_nome VARCHAR(100),
                tipo_instrumento_codigo INT,
                tipo_instrumento_nome VARCHAR(200),
                srp BOOLEAN DEFAULT FALSE,
                usuario_nome VARCHAR(255),
                uf_sigla CHAR(2),
                uf_nome VARCHAR(100),
                municipio_nome VARCHAR(200),
                codigo_ibge VARCHAR(20),
                codigo_unidade VARCHAR(50),
                nome_unidade VARCHAR(255),
                amparo_legal_codigo INT,
                amparo_legal_nome TEXT,
                amparo_legal_descricao TEXT,
                metadata_json JSONB,
                numero_compra VARCHAR(100),
                processo VARCHAR(255)
            )
        `);

        // --- USER LICITACAO INTERACTIONS (Dopamine Feed) ---
        await query(`
            CREATE TABLE IF NOT EXISTS user_licitacao_interactions (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                licitacao_id INT NOT NULL,
                interaction_type VARCHAR(50) NOT NULL, -- 'save', 'skip', 'view', 'dislike', 'download', 'undislike', 'unsave'
                interaction_data JSONB, -- store extra info like file downloaded
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (licitacao_id) REFERENCES licitacoes(id) ON DELETE CASCADE
            )
        `);
        // Indexes for performance
        await query(`CREATE INDEX IF NOT EXISTS idx_interactions_user ON user_licitacao_interactions (user_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_interactions_lic ON user_licitacao_interactions (licitacao_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_interactions_type ON user_licitacao_interactions (interaction_type)`);

        // Migration for new raw_data columns
        await query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licitacoes' AND column_name='raw_data_itens') THEN
                    ALTER TABLE licitacoes ADD COLUMN raw_data_itens JSONB;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licitacoes' AND column_name='raw_data_arquivos') THEN
                    ALTER TABLE licitacoes ADD COLUMN raw_data_arquivos JSONB;
                END IF;
            END $$;
        `);
        // Trigger for licitacoes
        await query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_licitacoes_updated_at') THEN
                    CREATE TRIGGER update_licitacoes_updated_at
                    BEFORE UPDATE ON licitacoes
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
                END IF;
            END $$;
        `);

        // Indexes
        await query(`CREATE INDEX IF NOT EXISTS idx_licitacoes_cnpj ON licitacoes (cnpj_orgao)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_licitacoes_data_pub ON licitacoes (data_publicacao_pncp)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_licitacoes_situacao ON licitacoes (situacao_compra)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_licitacoes_modalidade ON licitacoes (modalidade_licitacao)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_licitacoes_uf_sigla ON licitacoes (uf_sigla)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_licitacoes_municipio ON licitacoes (municipio_nome)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_licitacoes_srp ON licitacoes (srp)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_licitacoes_amparo_legal ON licitacoes (amparo_legal_codigo)`);
        // Full Text Index using GIN
        await query(`CREATE INDEX IF NOT EXISTS idx_licitacoes_fulltext ON licitacoes USING GIN (to_tsvector('portuguese', COALESCE(objeto_compra, '') || ' ' || COALESCE(informacao_complementar, '')))`);


        await query(`
            CREATE TABLE IF NOT EXISTS licitacoes_itens (
                id SERIAL PRIMARY KEY,
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
                material_ou_servico CHAR(1),
                material_ou_servico_nome VARCHAR(50),

                -- Novos campos expandidos
                criterio_julgamento_id INT,
                criterio_julgamento_nome VARCHAR(255),
                tipo_beneficio_id INT,
                tipo_beneficio_nome VARCHAR(255),
                item_categoria_id INT,
                item_categoria_nome VARCHAR(255),
                orcamento_sigiloso BOOLEAN DEFAULT FALSE,
                ncm_nbs_codigo VARCHAR(50),
                ncm_nbs_descricao TEXT,
                incentivo_produtivo_basico BOOLEAN DEFAULT FALSE,
                
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (licitacao_id) REFERENCES licitacoes(id) ON DELETE CASCADE
            )
        `);
        // Migration safe-check
        await query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licitacoes_itens' AND column_name='criterio_julgamento_id') THEN
                    ALTER TABLE licitacoes_itens ADD COLUMN criterio_julgamento_id INT;
                    ALTER TABLE licitacoes_itens ADD COLUMN criterio_julgamento_nome VARCHAR(255);
                    ALTER TABLE licitacoes_itens ADD COLUMN tipo_beneficio_id INT;
                    ALTER TABLE licitacoes_itens ADD COLUMN tipo_beneficio_nome VARCHAR(255);
                    ALTER TABLE licitacoes_itens ADD COLUMN item_categoria_id INT;
                    ALTER TABLE licitacoes_itens ADD COLUMN item_categoria_nome VARCHAR(255);
                    ALTER TABLE licitacoes_itens ADD COLUMN orcamento_sigiloso BOOLEAN DEFAULT FALSE;
                    ALTER TABLE licitacoes_itens ADD COLUMN ncm_nbs_codigo VARCHAR(50);
                    ALTER TABLE licitacoes_itens ADD COLUMN ncm_nbs_descricao TEXT;
                    ALTER TABLE licitacoes_itens ADD COLUMN incentivo_produtivo_basico BOOLEAN DEFAULT FALSE;
                END IF;
                END IF;
            END $$;
        `);

        // Migration: Add Unique Constraint for Items (Upsert support)
        try {
            await query("CREATE UNIQUE INDEX IF NOT EXISTS idx_licitacoes_itens_unique ON licitacoes_itens (licitacao_id, numero_item)");
            // Also need constraint for ON CONFLICT to work? No, unique index is often enough for postgres upsert inference,
            // BUT "ON CONFLICT (col1, col2)" requires a unique constraint/index.
            // Let's add constraint explicitly if possible or rely on index.  Index is safer.
            // Actually postgres "ON CONFLICT (col1, col2)" maps to the unique index.

            // NOTE: If invalid duplicates exist, this might fail. We should probably clean them?
            // For now, let's assume user accepts that start might throw error if duplicates exist,
            // or we do a "DELETE DUPLICATES" before?
            // Safer: do nothing if it fails, and warn user.
        } catch (e) {
            console.log('[Database] Warning: Could not create unique index on licitacoes_itens:', e.message);
        }

        await query(`CREATE INDEX IF NOT EXISTS idx_licitacoes_itens_licitacao ON licitacoes_itens (licitacao_id)`);

        await query(`
            CREATE TABLE IF NOT EXISTS licitacoes_sync_control (
                id SERIAL PRIMARY KEY,
                
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
                
                started_at TIMESTAMP,
                finished_at TIMESTAMP,
                batch_id VARCHAR(50), -- Grouping ID
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Migration: Ensure batch_id exists
        try {
            await query("ALTER TABLE licitacoes_sync_control ADD COLUMN IF NOT EXISTS batch_id VARCHAR(50)");
        } catch (e) {
            console.log('[Database] Note: batch_id column check failed (might exist or permissions):', e.message);
        }
        // Trigger for sync_control
        await query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_sync_control_updated_at') THEN
                    CREATE TRIGGER update_sync_control_updated_at
                    BEFORE UPDATE ON licitacoes_sync_control
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
                END IF;
            END $$;
        `);

        // Ensure job_id and logs exist in licitacoes_sync_control
        // Ensure job_id and logs exist in licitacoes_sync_control
        console.log('[Database] Checking/Running migration for job_id and logs columns...');
        try {
            await query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licitacoes_sync_control' AND column_name='job_id') THEN
                        ALTER TABLE licitacoes_sync_control ADD COLUMN job_id VARCHAR(100);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licitacoes_sync_control' AND column_name='logs') THEN
                        ALTER TABLE licitacoes_sync_control ADD COLUMN logs JSONB DEFAULT '[]'::jsonb;
                    END IF;
                END $$;
            `);
            console.log('[Database] Migration for job_id/logs completed (or skipped).');
        } catch (migErr) {
            console.error('[Database] Warning: Failed to run schema migration (job_id/logs):', migErr.message);
        }

        // --- LICITACOES ARQUIVOS TABLE (PDFs e anexos) ---
        await query(`
            CREATE TABLE IF NOT EXISTS licitacoes_arquivos (
                id SERIAL PRIMARY KEY,
                licitacao_id INT NOT NULL,
                sequencial_documento INT,
                titulo VARCHAR(500),
                tipo_documento_id INT,
                tipo_documento_nome VARCHAR(200),
                tipo_documento_descricao TEXT,
                url TEXT NOT NULL,
                data_publicacao TIMESTAMP,
                status_ativo BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (licitacao_id) REFERENCES licitacoes(id) ON DELETE CASCADE
            )
        `);
        await query(`CREATE INDEX IF NOT EXISTS idx_licitacoes_arquivos_licitacao ON licitacoes_arquivos (licitacao_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_licitacoes_arquivos_tipo ON licitacoes_arquivos (tipo_documento_id)`);

        // Migration: Add Unique Constraint for Files
        try {
            await query("CREATE UNIQUE INDEX IF NOT EXISTS idx_licitacoes_arquivos_unique ON licitacoes_arquivos (licitacao_id, sequencial_documento)");
        } catch (e) {
            console.log('[Database] Warning: Could not create unique index on licitacoes_arquivos:', e.message);
        }

        // --- USER LICITACOES PREFERENCES TABLE ---
        await query(`
            CREATE TABLE IF NOT EXISTS user_licitacoes_preferences (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                
                -- Palavras-chave (JSON array)
                keywords JSONB,
                
                -- Localizações preferenciais
                preferred_ufs JSONB,
                preferred_municipios JSONB,
                
                -- Modalidades preferidas
                preferred_modalidades JSONB,
                
                -- Faixas de valor
                min_value DECIMAL(15, 2),
                max_value DECIMAL(15, 2),
                
                -- Categorias (órgãos, esfera, poder)
                preferred_esferas JSONB,
                preferred_poderes JSONB,
                
                -- Configurações de visualização
                default_view_mode VARCHAR(20) DEFAULT 'story',
                cards_per_row INT DEFAULT 3,
                
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT unique_user_prefs UNIQUE (user_id)
            )
        `);
        // Trigger for preferences
        await query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_prefs_updated_at') THEN
                    CREATE TRIGGER update_user_prefs_updated_at
                    BEFORE UPDATE ON user_licitacoes_preferences
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
                END IF;
            END $$;
        `);

        // --- USER SAVED LICITACOES TABLE (for favorites) ---
        await query(`
            CREATE TABLE IF NOT EXISTS user_saved_licitacoes (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                licitacao_id INT NOT NULL,
                saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                notes TEXT,
                
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (licitacao_id) REFERENCES licitacoes(id) ON DELETE CASCADE,
                CONSTRAINT unique_save UNIQUE (user_id, licitacao_id)
            )
        `);

        // --- USER DISLIKED LICITACOES TABLE (interest control) ---
        await query(`
            CREATE TABLE IF NOT EXISTS user_disliked_licitacoes (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                licitacao_id INT NOT NULL,
                disliked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (licitacao_id) REFERENCES licitacoes(id) ON DELETE CASCADE,
                CONSTRAINT unique_dislike UNIQUE (user_id, licitacao_id)
            )
        `);

        // --- USER LICITACAO INTERACTIONS TABLE (catalog all user actions for ML) ---
        await query(`
            CREATE TABLE IF NOT EXISTS user_licitacao_interactions (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                licitacao_id INT NOT NULL,
                action_type VARCHAR(30) NOT NULL,
                metadata JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (licitacao_id) REFERENCES licitacoes(id) ON DELETE CASCADE
            )
        `);
        await query(`CREATE INDEX IF NOT EXISTS idx_interactions_user ON user_licitacao_interactions(user_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_interactions_licitacao ON user_licitacao_interactions(licitacao_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_interactions_action ON user_licitacao_interactions(action_type)`);

        // --- USER CNPJ DATA TABLE (company information for personalization) ---
        await query(`
            CREATE TABLE IF NOT EXISTS user_cnpj_data (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL UNIQUE,
                
                -- Identificação
                cnpj VARCHAR(18) NOT NULL,
                razao_social VARCHAR(500),
                nome_fantasia VARCHAR(500),
                
                -- Situação Cadastral
                situacao_cadastral VARCHAR(100),
                data_situacao VARCHAR(20),
                matriz_filial VARCHAR(20),
                data_abertura VARCHAR(20),
                
                -- CNAEs
                cnae_principal VARCHAR(20),
                cnae_principal_descricao TEXT,
                cnaes_secundarios JSONB,
                
                -- Endereço
                logradouro VARCHAR(500),
                numero VARCHAR(50),
                complemento VARCHAR(200),
                bairro VARCHAR(200),
                cep VARCHAR(20),
                municipio VARCHAR(200),
                uf VARCHAR(2),
                
                -- Contatos
                telefones JSONB,
                email VARCHAR(200),
                
                -- Informações Empresariais
                capital_social DECIMAL(15,2),
                porte_empresa VARCHAR(50),
                natureza_juridica VARCHAR(200),
                
                -- Simples Nacional
                optante_simples BOOLEAN DEFAULT FALSE,
                optante_mei BOOLEAN DEFAULT FALSE,
                
                -- Sócios
                socios JSONB,
                
                -- Raw Data
                raw_data JSONB,
                
                -- Controle
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        // Trigger for CNPJ data
        await query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_cnpj_updated_at') THEN
                    CREATE TRIGGER update_user_cnpj_updated_at
                    BEFORE UPDATE ON user_cnpj_data
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
                END IF;
            END $$;
        `);
        await query(`CREATE INDEX IF NOT EXISTS idx_user_cnpj_cnpj ON user_cnpj_data (cnpj)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_user_cnpj_cnae ON user_cnpj_data (cnae_principal)`);

        console.log('[Database] ✅ Tables created/verified');

        // Check for default admin
        const { rows: users } = await pool.query("SELECT * FROM users WHERE username = $1", ['admin']);
        if (users.length === 0) {
            const hash = await bcrypt.hash('admin', 10);
            await pool.query("INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)", ['admin', hash, 'admin']);
            console.log('[Database] Default admin user created (admin/admin)');
        }

    } catch (e) {
        console.error('[Database] ❌ Connection/Init failed:', e.message);
        console.error(e.stack);
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
    const { rows } = await p.query("SELECT * FROM users WHERE username = $1", [username]);
    return rows[0];
}

async function getUserById(id) {
    const p = await getPool();
    if (!p) return null;
    const { rows } = await p.query("SELECT * FROM users WHERE id = $1", [id]);
    return rows[0];
}

async function createUser(userData) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");
    const { username, password, role, full_name, cpf, cnpj } = userData;
    const hash = await bcrypt.hash(password, 10);
    await p.query(
        "INSERT INTO users (username, password_hash, role, full_name, cpf, cnpj, current_credits) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [username, hash, role || 'user', full_name, cpf, cnpj, 500]
    );
}

async function getAllUsers() {
    const p = await getPool();
    if (!p) return [];
    const { rows } = await p.query("SELECT id, username, role, created_at, full_name, current_credits FROM users");
    return rows;
}

async function deleteUser(id) {
    const p = await getPool();
    if (!p) return;
    await p.query("DELETE FROM users WHERE id = $1", [id]);
}

async function updateUserRole(id, role) {
    const p = await getPool();
    if (!p) return;
    await p.query("UPDATE users SET role = $1 WHERE id = $2", [role, id]);
}


// --- GROUP & CREDIT FUNCTIONS ---

async function createGroup(name, description) {
    const p = await getPool();
    if (!p) return;
    await p.query("INSERT INTO groups (name, description) VALUES ($1, $2)", [name, description]);
}

async function getAllGroups() {
    const p = await getPool();
    if (!p) return [];
    const { rows } = await p.query("SELECT * FROM groups ORDER BY name ASC");
    return rows;
}

async function getUserGroups(userId) {
    const p = await getPool();
    if (!p) return [];
    const { rows } = await p.query(`
        SELECT g.*
        FROM groups g
        JOIN user_groups ug ON g.id = ug.group_id
        WHERE ug.user_id = $1
    `, [userId]);
    return rows;
}

async function addUserToGroup(userId, groupId) {
    const p = await getPool();
    if (!p) return;
    try {
        await p.query("INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [userId, groupId]);
    } catch (e) {
        // Ignore duplicates
    }
}

async function removeUserFromGroup(userId, groupId) {
    const p = await getPool();
    if (!p) return;
    await p.query("DELETE FROM user_groups WHERE user_id = $1 AND group_id = $2", [userId, groupId]);
}

async function addCredits(userId, amount, reason, taskId = null) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");

    const client = await p.connect();
    try {
        await client.query('BEGIN');

        // 1. Insert Ledger
        await client.query(
            "INSERT INTO credits_ledger (user_id, amount, reason, task_id) VALUES ($1, $2, $3, $4)",
            [userId, amount, reason, taskId]
        );

        // 2. Update User Balance
        await client.query(
            "UPDATE users SET current_credits = current_credits + $1 WHERE id = $2",
            [amount, userId]
        );

        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

async function getUserCredits(userId) {
    const p = await getPool();
    if (!p) return 0;
    const { rows } = await p.query("SELECT current_credits FROM users WHERE id = $1", [userId]);
    return rows[0] ? rows[0].current_credits : 0;
}


// --- TASK FUNCTIONS ---
async function createTask(task) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");

    const { rows } = await p.query("SELECT MAX(position) as maxpos FROM tasks");
    const nextPos = (rows[0].maxpos || 0) + 1;

    const sql = `INSERT INTO tasks (id, name, status, cep, input_file, log_file, position, tags, external_link, module_name, group_id, user_id, cost_estimate) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`;
    await p.query(sql, [
        task.id,
        task.name,
        'pending',
        task.cep,
        task.input_file,
        task.log_file,
        nextPos,
        JSON.stringify([]), // tags
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

    let sql = `UPDATE tasks SET status = $1 WHERE id = $2`;
    let params = [status, id];

    if (status === 'completed' || status === 'failed') {
        sql = `UPDATE tasks SET status = $1, finished_at = NOW(), output_file = $2 WHERE id = $3`;
        params = [status, outputFile, id];
    } else if (status === 'aborted') {
        sql = `UPDATE tasks SET status = $1, finished_at = NOW() WHERE id = $2`;
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
        const sql = `SELECT * FROM tasks WHERE ${statusSql} ORDER BY position ASC, created_at DESC LIMIT $1 OFFSET $2`;
        const { rows } = await p.query(sql, [limit, offset]);
        return rows;
    } else {
        // User sees tasks from their groups OR their own tasks
        // Get user groups
        const userGroups = await getUserGroups(user.id);
        const groupIds = userGroups.map(g => g.id);

        // Build dynamic query with variable handling for array
        let whereClause = `(${statusSql}) AND (user_id = $1`;
        const queryParams = [user.id];

        if (groupIds.length > 0) {
            // For array IN clause in Postgres we can use = ANY($2::int[])
            whereClause += ` OR group_id = ANY($2::int[])`;
            queryParams.push(groupIds);
        } else {
            queryParams.push([]); // Dummy empty array to keep numbering consistent if logic changes
        }
        whereClause += `)`;

        // Add limit/offset params
        queryParams.push(limit);
        queryParams.push(offset);
        // Correct param indexes: user.id=$1, groupIds=$2, limit=$3, offset=$4

        const sql = `SELECT * FROM tasks WHERE ${whereClause} ORDER BY position ASC, created_at DESC LIMIT $3 OFFSET $4`;
        const { rows } = await p.query(sql, queryParams);
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

    const { rows } = await p.query(sql);
    return rows;
}

async function getTaskById(id) {
    const p = await getPool();
    if (!p) return null;

    const { rows } = await p.query("SELECT * FROM tasks WHERE id = $1", [id]);
    return rows[0];
}

async function updateTaskPosition(id, position) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");
    await p.query("UPDATE tasks SET position = $1 WHERE id = $2", [position, id]);
}

async function updateTaskTags(id, tags) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");
    const tagsStr = typeof tags === 'string' ? tags : JSON.stringify(tags);
    await p.query("UPDATE tasks SET tags = $1 WHERE id = $2", [tagsStr, id]);
}

async function getNextPendingTask() {
    const p = await getPool();
    if (!p) return null;

    const { rows } = await p.query("SELECT * FROM tasks WHERE status = 'pending' ORDER BY position ASC LIMIT 1");
    return rows[0];
}

async function forceStartTask(id) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");
    await p.query("UPDATE tasks SET status = 'pending', position = -1 WHERE id = $1", [id]);
}

// --- NEW DB PERSISTENCE FUNCTIONS ---

async function createTaskItems(taskId, items) {
    const p = await getPool();
    if (!p) return;
    // items: array of { id, description, valor_venda, quantidade }

    if (items.length === 0) return;

    // Helper to generate ($1, $2, $3, $4, $5), ($6...) strings
    const expand = (rowCount, colCount, startAt = 1) =>
        Array.from({ length: rowCount }, (_, i) =>
            `(${Array.from({ length: colCount }, (_, j) => `$${i * colCount + j + startAt}`).join(', ')})`
        ).join(', ');

    const flatValues = [];
    items.forEach(i => {
        flatValues.push(taskId);
        flatValues.push(i.ID || i.id);
        flatValues.push(i.Descricao || i.description || i.Description);
        flatValues.push(i.valor_venda);
        flatValues.push(i.quantidade);
    });

    const sql = `INSERT INTO task_items (task_id, original_id, description, max_price, quantity) VALUES ${expand(items.length, 5)}`;
    await p.query(sql, flatValues);
}

async function getTaskItem(taskId, originalId) {
    const p = await getPool();
    const { rows } = await p.query("SELECT * FROM task_items WHERE task_id = $1 AND original_id = $2", [taskId, originalId]);
    return rows[0];
}

async function getTaskItems(taskId) {
    const p = await getPool();
    if (!p) return [];
    const { rows } = await p.query("SELECT * FROM task_items WHERE task_id = $1 ORDER BY id ASC", [taskId]);
    return rows;
}

async function saveCandidates(taskItemId, candidates, selectedIndex) {
    const p = await getPool();
    if (!p || !taskItemId) return;
    if (!candidates || candidates.length === 0) return;

    const expand = (rowCount, colCount, startAt = 1) =>
        Array.from({ length: rowCount }, (_, i) =>
            `(${Array.from({ length: colCount }, (_, j) => `$${i * colCount + j + startAt}`).join(', ')})`
        ).join(', ');

    const flatValues = [];
    candidates.forEach((c, index) => {
        flatValues.push(taskItemId);
        flatValues.push(c.title || c.name || 'N/A');
        flatValues.push(c.totalPrice || c.price || 0);
        flatValues.push(c.link);
        flatValues.push(c.image || c.thumbnail || null);
        flatValues.push(c.store || 'N/A');
        flatValues.push(JSON.stringify(c.specs || {}));
        flatValues.push(c.risk_score || '-');
        flatValues.push(c.aiReasoning || c.reasoning || '-');
        flatValues.push(index === selectedIndex); // is_selected
        flatValues.push(c.gtin || null);
        flatValues.push(c.mpn || null);
        flatValues.push(c.enrichment_source || null);
        flatValues.push(c.seller_reputation || null);
    });

    const sql = `INSERT INTO item_candidates 
        (task_item_id, title, price, link, image_url, store, specs, risk_score, ai_reasoning, is_selected, gtin, manufacturer_part_number, enrichment_source, seller_reputation) 
        VALUES ${expand(candidates.length, 14)}`;

    await p.query(sql, flatValues);

    // Update item status
    await p.query("UPDATE task_items SET status = 'done' WHERE id = $1", [taskItemId]);
}

async function logTaskMessage(taskId, message, level = 'info') {
    const p = await getPool();
    if (!p) return;
    try {
        await p.query("INSERT INTO task_logs (task_id, message, level) VALUES ($1, $2, $3)", [taskId, message, level]);
    } catch (e) {
        console.error("Failed to log to DB:", e);
    }
}

async function getTaskLogs(taskId) {
    const p = await getPool();
    if (!p) return [];
    const { rows } = await p.query("SELECT * FROM task_logs WHERE task_id = $1 ORDER BY timestamp ASC", [taskId]);
    return rows;
}

// Fetch Full Results for Excel Generation
async function createTaskMetadata(taskId, data) {
    const p = await getPool();
    if (!p) return;
    try {
        await p.query("INSERT INTO task_metadata (task_id, data) VALUES ($1, $2)", [taskId, JSON.stringify(data)]);
    } catch (e) {
        console.error("Failed to save metadata:", e);
    }
}

async function getTaskFullResults(taskId) {
    const p = await getPool();
    if (!p) return [];

    // Get Items
    const { rows: items } = await p.query("SELECT * FROM task_items WHERE task_id = $1", [taskId]);

    // For each item, get candidates
    const results = [];
    for (const item of items) {
        const { rows: candidates } = await p.query("SELECT * FROM item_candidates WHERE task_item_id = $1", [item.id]);

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
    const { rows } = await p.query("SELECT * FROM task_metadata WHERE task_id = $1", [taskId]);
    return rows[0];
}

async function updateTaskItemLockStatus(itemId, isUnlocked) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");
    await p.query("UPDATE task_items SET is_unlocked = $1 WHERE id = $2", [isUnlocked, itemId]);
}

async function unlockAllTaskItems(taskId) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");
    await p.query("UPDATE task_items SET is_unlocked = TRUE WHERE task_id = $1", [taskId]);
}

// --- OPPORTUNITIES (RADAR/ORACLE) FUNCTIONS ---

async function createOpportunity(userId, data) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");

    // data expects: { title, municipality, metadata, locked_content, items, ipm_score }
    const sql = `INSERT INTO opportunities
        (user_id, title, municipality, metadata_json, locked_content_json, items_json, ipm_score, unlocked_modules)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`;

    const { rows } = await p.query(sql, [
        userId || null, // If null, it's global/radar
        data.title,
        data.municipality,
        JSON.stringify(data.metadata),
        JSON.stringify(data.locked_content),
        JSON.stringify(data.items),
        data.ipm_score || 0,
        JSON.stringify([]) // unlocked_modules starts empty
    ]);
    return rows[0].id;
}

async function getRadarOpportunities() {
    const p = await getPool();
    if (!p) return [];
    // Where user_id is NULL (Admin/System generated)
    const { rows } = await p.query("SELECT * FROM opportunities WHERE user_id IS NULL ORDER BY created_at DESC");
    return rows;
}

async function getUserOpportunities(userId) {
    const p = await getPool();
    if (!p) return [];
    const { rows } = await p.query("SELECT * FROM opportunities WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
    return rows;
}

async function getOpportunityById(id) {
    const p = await getPool();
    if (!p) return null;
    const { rows } = await p.query("SELECT * FROM opportunities WHERE id = $1", [id]);
    return rows[0];
}


// --- SETTINGS FUNCTIONS ---
async function getSetting(key) {
    const p = await getPool();
    if (!p) return null;
    const { rows } = await p.query("SELECT setting_value FROM settings WHERE setting_key = $1", [key]);
    return rows[0] ? rows[0].setting_value : null;
}

async function unlockOpportunityModule(opportunityId, moduleKey) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");

    // Get current unlocked modules
    const opp = await getOpportunityById(opportunityId);
    if (!opp) throw new Error("Analysis not found");

    let current = opp.unlocked_modules; // Already JSONB in Postgres
    if (!Array.isArray(current)) current = [];

    if (!current.includes(moduleKey)) {
        current.push(moduleKey);
        await p.query("UPDATE opportunities SET unlocked_modules = $1 WHERE id = $2", [JSON.stringify(current), opportunityId]);
    }
}

async function setSetting(key, value) {
    const p = await getPool();
    if (!p) return;
    await p.query(`
        INSERT INTO settings (setting_key, setting_value)
        VALUES ($1, $2)
        ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2
    `, [key, value]);
}

// --- NOTIFICATION FUNCTIONS ---
async function createNotification(userId, title, message, link) {
    const p = await getPool();
    if (!p) return;
    await p.query("INSERT INTO notifications (user_id, title, message, link) VALUES ($1, $2, $3, $4)", [userId, title, message, link]);
}

async function getUnreadNotifications(userId) {
    const p = await getPool();
    if (!p) return [];
    const { rows } = await p.query("SELECT * FROM notifications WHERE user_id = $1 AND is_read = FALSE ORDER BY created_at DESC", [userId]);
    return rows;
}

async function markNotificationAsRead(id) {
    const p = await getPool();
    if (!p) return;
    await p.query("UPDATE notifications SET is_read = TRUE WHERE id = $1", [id]);
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
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43)
    ON CONFLICT (numero_sequencial_pncp) DO UPDATE SET
        situacao_compra = EXCLUDED.situacao_compra,
        modalidade_licitacao = EXCLUDED.modalidade_licitacao,
        valor_estimado_total = EXCLUDED.valor_estimado_total,
        valor_total_homologado = EXCLUDED.valor_total_homologado,
        data_abertura_proposta = EXCLUDED.data_abertura_proposta,
        data_encerramento_proposta = EXCLUDED.data_encerramento_proposta,
        data_atualizacao = EXCLUDED.data_atualizacao,
        data_atualizacao_global = EXCLUDED.data_atualizacao_global,
        informacao_complementar = EXCLUDED.informacao_complementar,
        objeto_compra = EXCLUDED.objeto_compra,
        link_processo_eletronico = EXCLUDED.link_processo_eletronico,
        updated_at = NOW(),
        raw_data_json = EXCLUDED.raw_data_json,
        metadata_json = EXCLUDED.metadata_json
    RETURNING id`;

    const { rows } = await p.query(sql, [
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
        data.srp, // Boolean adapts correctly
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

    return rows[0].id;
}

async function getLicitacoes(filters = {}, limit = 50, offset = 0) {
    const p = await getPool();
    if (!p) return [];

    let sql = 'SELECT * FROM licitacoes WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (filters.cnpj_orgao) {
        sql += ` AND cnpj_orgao = $${paramIndex++}`;
        params.push(filters.cnpj_orgao);
    }

    if (filters.modalidade) {
        sql += ` AND modalidade_licitacao = $${paramIndex++}`;
        params.push(filters.modalidade);
    }

    if (filters.search) {
        // Use Postgres Full Text Search (websearch_to_tsquery is great for user input)
        sql += ` AND to_tsvector('portuguese', COALESCE(objeto_compra, '') || ' ' || COALESCE(informacao_complementar, '')) @@ websearch_to_tsquery('portuguese', $${paramIndex++})`;
        params.push(filters.search);
    }

    sql += ` ORDER BY data_publicacao_pncp DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const { rows } = await p.query(sql, params);
    return rows;
}

async function getLicitacaoById(id) {
    const p = await getPool();
    if (!p) return null;
    const { rows } = await p.query('SELECT * FROM licitacoes WHERE id = $1', [id]);
    return rows[0];
}

async function createLicitacaoArquivo(licitacaoId, data) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");

    // Use ON CONFLICT on (licitacao_id, sequencial_documento) potentially.
    // If sequencer is not reliable, URL might be improved. But PNCP has `sequencialDocumento`.

    // NOTE: This assumes we added the unique constraint in initDB!
    const sql = `INSERT INTO licitacoes_arquivos (
        licitacao_id, sequencial_documento, titulo, tipo_documento_id,
        tipo_documento_nome, tipo_documento_descricao, url, data_publicacao, status_ativo
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (licitacao_id, sequencial_documento) DO UPDATE SET
        titulo = EXCLUDED.titulo,
        url = EXCLUDED.url,
        status_ativo = EXCLUDED.status_ativo
    RETURNING id`;

    const { rows } = await p.query(sql, [
        licitacaoId,
        data.sequencialDocumento,
        data.titulo,
        data.tipoDocumentoId,
        data.tipoDocumentoNome,
        data.tipoDocumentoDescricao,
        data.url,
        data.dataPublicacao,
        data.statusAtivo
    ]);

    return rows[0].id;
}

async function getLicitacaoArquivos(licitacaoId) {
    const p = await getPool();
    if (!p) return [];

    const { rows } = await p.query(
        'SELECT * FROM licitacoes_arquivos WHERE licitacao_id = $1 AND status_ativo = TRUE ORDER BY sequencial_documento',
        [licitacaoId]
    );
    return rows;
}

async function getLicitacaoItens(licitacaoId) {
    const p = await getPool();
    if (!p) return [];
    const { rows } = await p.query(
        'SELECT * FROM licitacoes_itens WHERE licitacao_id = $1 ORDER BY numero_item ASC',
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
        codigo_catmat, descricao_catmat, situacao_item,
        material_ou_servico, material_ou_servico_nome,
        criterio_julgamento_id, criterio_julgamento_nome,
        tipo_beneficio_id, tipo_beneficio_nome,
        item_categoria_id, item_categoria_nome,
        orcamento_sigiloso, ncm_nbs_codigo, ncm_nbs_descricao,
        incentivo_produtivo_basico
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
    ON CONFLICT (licitacao_id, numero_item) DO UPDATE SET
        descricao_item = EXCLUDED.descricao_item,
        quantidade = EXCLUDED.quantidade,
        unidade_medida = EXCLUDED.unidade_medida,
        valor_unitario_estimado = EXCLUDED.valor_unitario_estimado,
        valor_total_estimado = EXCLUDED.valor_total_estimado,
        situacao_item = EXCLUDED.situacao_item,
        codigo_catmat = EXCLUDED.codigo_catmat,
        descricao_catmat = EXCLUDED.descricao_catmat,
        material_ou_servico = EXCLUDED.material_ou_servico,
        material_ou_servico_nome = EXCLUDED.material_ou_servico_nome
    RETURNING id`;

    const { rows } = await p.query(sql, [
        licitacaoId,
        itemData.numeroItem,
        itemData.descricaoItem,
        itemData.quantidade,
        itemData.unidadeMedida,
        itemData.valorUnitarioEstimado,
        itemData.valorTotalEstimado,
        itemData.codigoCatmat,
        itemData.descricaoCatmat,
        itemData.situacaoItem,
        itemData.materialOuServico,
        itemData.materialOuServicoNome,
        itemData.criterioJulgamentoId,
        itemData.criterioJulgamentoNome,
        itemData.tipoBeneficioId,
        itemData.tipoBeneficioNome,
        itemData.itemCategoriaId,
        itemData.itemCategoriaNome,
        itemData.orcamentoSigiloso,
        itemData.ncmNbsCodigo,
        itemData.ncmNbsDescricao,
        itemData.incentivoProdutivoBasico
    ]);

    return rows[0].id;
}

async function createSyncControl(params) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");

    // Ensure batch_id column exists (Migrate on the fly if needed - simple check)
    // In production, use proper migrations. Here we rely on initDB or manual ALTER.

    const sql = `INSERT INTO licitacoes_sync_control 
        (sync_type, status, data_inicial, data_final, cnpj_orgao, total_pages, items_per_page, started_at, batch_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8) RETURNING id`;

    const { rows } = await p.query(sql, [
        params.syncType,
        'running',
        params.dataInicial,
        params.dataFinal,
        params.cnpjOrgao || null,
        params.totalPages || 0,
        params.itemsPerPage || 500,
        params.batchId || null // New Batch ID
    ]);

    return rows[0].id;
}

async function updateSyncControl(id, updates) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.status) { fields.push(`status = $${paramIndex++}`); values.push(updates.status); }
    if (updates.current_page) { fields.push(`current_page = $${paramIndex++}`); values.push(updates.current_page); }
    if (updates.total_imported !== undefined) { fields.push(`total_imported = $${paramIndex++}`); values.push(updates.total_imported); }
    if (updates.total_duplicates !== undefined) { fields.push(`total_duplicates = $${paramIndex++}`); values.push(updates.total_duplicates); }
    if (updates.total_errors !== undefined) { fields.push(`total_errors = $${paramIndex++}`); values.push(updates.total_errors); }
    if (updates.error_message) { fields.push(`error_message = $${paramIndex++}`); values.push(updates.error_message); }
    if (updates.logs) {
        fields.push(`logs = COALESCE(logs, '[]'::jsonb) || $${paramIndex++}::jsonb`);
        values.push(JSON.stringify(updates.logs));
    }
    if (updates.total_pages !== undefined) { fields.push(`total_pages = $${paramIndex++}`); values.push(updates.total_pages); }
    if (updates.job_id) { fields.push(`job_id = $${paramIndex++}`); values.push(updates.job_id); }

    if (updates.finished_at) { fields.push('finished_at = NOW()'); }

    if (fields.length === 0) return;

    values.push(id);

    const sql = `UPDATE licitacoes_sync_control SET ${fields.join(', ')} WHERE id = $${paramIndex}`;
    await p.query(sql, values);
}

async function getBatchStatus(batchId) {
    const p = await getPool();
    if (!p) return null;

    // Aggregate stats
    const sql = `
        SELECT 
            COUNT(*) as total_jobs,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
            SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running_jobs,
            SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued_jobs,
            SUM(total_imported) as total_imported,
            SUM(total_duplicates) as total_duplicates,
            SUM(total_errors) as total_errors,
            MIN(started_at) as started_at,
            MAX(finished_at) as finished_at,
            json_agg(json_build_object(
                'id', id,
                'data_inicial', data_inicial,
                'data_final', data_final,
                'status', status,
                'current_page', current_page,
                'total_pages', total_pages,
                'total_imported', total_imported
            ) ORDER BY data_inicial ASC) as jobs
        FROM licitacoes_sync_control
        WHERE batch_id = $1
    `;

    const { rows } = await p.query(sql, [batchId]);
    return rows[0];
}

async function getActiveSyncControl() {
    const p = await getPool();
    if (!p) return null;
    const { rows } = await p.query(
        "SELECT * FROM licitacoes_sync_control WHERE status = 'running' ORDER BY started_at DESC LIMIT 1"
    );
    return rows[0];
}

async function getLatestSyncControl() {
    const p = await getPool();
    if (!p) return null;
    const { rows } = await p.query(
        "SELECT * FROM licitacoes_sync_control ORDER BY created_at DESC LIMIT 1"
    );
    return rows[0];
}

// --- USER LICITACOES PREFERENCES FUNCTIONS ---

async function getUserLicitacoesPreferences(userId) {
    const p = await getPool();
    if (!p) return null;

    const { rows } = await p.query(
        'SELECT * FROM user_licitacoes_preferences WHERE user_id = $1',
        [userId]
    );

    if (rows.length === 0) {
        // Return default preferences
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
    // Postgres JSONB is already an object, but if logic expected strings and parsed them, we should ensure they are objects.
    // pg driver returns parsed JSON for JSON columns automatically.

    // Safety check just in case
    if (typeof prefs.keywords === 'string') prefs.keywords = JSON.parse(prefs.keywords);
    // ... repeat if necessary, but typically not needed with pg driver and jsonb

    return prefs;
}

async function updateUserLicitacoesPreferences(userId, preferences) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");

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

    const sql = `INSERT INTO user_licitacoes_preferences 
        (user_id, keywords, preferred_ufs, preferred_municipios, 
         preferred_modalidades, min_value, max_value,
         preferred_esferas, preferred_poderes, default_view_mode, cards_per_row)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (user_id) DO UPDATE SET
         keywords = EXCLUDED.keywords,
         preferred_ufs = EXCLUDED.preferred_ufs,
         preferred_municipios = EXCLUDED.preferred_municipios,
         preferred_modalidades = EXCLUDED.preferred_modalidades,
         min_value = EXCLUDED.min_value,
         max_value = EXCLUDED.max_value,
         preferred_esferas = EXCLUDED.preferred_esferas,
         preferred_poderes = EXCLUDED.preferred_poderes,
         default_view_mode = EXCLUDED.default_view_mode,
         cards_per_row = EXCLUDED.cards_per_row`;

    await p.query(sql, [
        userId,
        data.keywords, data.preferred_ufs, data.preferred_municipios,
        data.preferred_modalidades, data.min_value, data.max_value,
        data.preferred_esferas, data.preferred_poderes,
        data.default_view_mode, data.cards_per_row
    ]);
}

async function getPersonalizedLicitacoes(userId, filters = {}, limit = 15, offset = 0) {
    const p = await getPool();
    if (!p) return [];

    const prefs = await getUserLicitacoesPreferences(userId);
    const cnpjData = await getUserCNPJData(userId);

    // Get IDs of already interacted licitacoes (skip, save, dislike)
    const interactedIds = await getInteractedLicitacaoIds(userId);

    let paramIndex = 1;
    let params = [];

    // Build the main query with normalized scoring (max 100%)
    // Score breakdown:
    // - Keywords (eliminatory + ranking): up to 40 pts
    // - Location (UF match): up to 25 pts
    // - Modalidade match: up to 15 pts
    // - Value range match: up to 10 pts
    // - CNPJ/CNAE bonus: up to 10 pts

    // Keywords scoring - eliminatory but flexible
    let keywordScore = '40'; // Default max score if no keywords defined
    let keywordFilter = '';

    if (prefs.keywords && prefs.keywords.length > 0) {
        // Build flexible keyword matching (case insensitive, accent tolerant via unaccent if available)
        const keywordConditions = prefs.keywords.map(kw => {
            const idx = paramIndex++;
            params.push(`%${kw}%`);
            return `(
                LOWER(COALESCE(l.objeto_compra, '')) LIKE LOWER($${idx}) OR 
                LOWER(COALESCE(l.informacao_complementar, '')) LIKE LOWER($${idx})
            )`;
        });

        // Eliminatory: at least one keyword must match
        keywordFilter = ` AND (${keywordConditions.join(' OR ')})`;

        // Scoring: 40 points distributed by number of matches
        const pointsPerKeyword = Math.round(40 / prefs.keywords.length);
        keywordScore = '(' + prefs.keywords.map((kw, i) => {
            const baseIdx = params.length - prefs.keywords.length + i + 1;
            return `(CASE WHEN LOWER(COALESCE(l.objeto_compra, '')) LIKE LOWER($${baseIdx}) THEN ${pointsPerKeyword} ELSE 0 END)`;
        }).join(' + ') + ')';
    }

    // Location scoring - up to 25 points
    let locationScore = '0';
    if (prefs.preferred_ufs && prefs.preferred_ufs.length > 0) {
        const idx = paramIndex++;
        params.push(prefs.preferred_ufs);
        locationScore = `(CASE WHEN l.uf_sigla = ANY($${idx}::text[]) THEN 25 ELSE 0 END)`;
    } else if (cnpjData && cnpjData.uf) {
        // If no preference but has CNPJ, use company UF
        const idx = paramIndex++;
        params.push(cnpjData.uf);
        locationScore = `(CASE WHEN l.uf_sigla = $${idx} THEN 25 ELSE 0 END)`;
    }

    // Modalidade scoring - up to 15 points
    let modalidadeScore = '0';
    if (prefs.preferred_modalidades && prefs.preferred_modalidades.length > 0) {
        const idx = paramIndex++;
        params.push(prefs.preferred_modalidades);
        modalidadeScore = `(CASE WHEN l.modalidade_licitacao = ANY($${idx}::text[]) THEN 15 ELSE 0 END)`;
    }

    // Value Range scoring - up to 10 points
    const minIdx = paramIndex++;
    const maxIdx = paramIndex++;
    params.push(prefs.min_value || 0, prefs.max_value || 999999999);
    const valueScore = `(CASE 
        WHEN l.valor_estimado_total IS NULL OR l.valor_estimado_total <= 0 THEN 5 
        WHEN l.valor_estimado_total BETWEEN $${minIdx} AND $${maxIdx} THEN 10 
        ELSE 0 
    END)`;

    // CNAE bonus - up to 10 points (for businesses that registered their CNPJ)
    let cnaeScore = '0';
    if (cnpjData && cnpjData.cnae_principal_descricao) {
        // Extract main keywords from CNAE description (first 3 significant words)
        const cnaeWords = cnpjData.cnae_principal_descricao
            .split(/\s+/)
            .filter(w => w.length > 4)
            .slice(0, 3);

        if (cnaeWords.length > 0) {
            cnaeScore = '(' + cnaeWords.map(word => {
                const idx = paramIndex++;
                params.push(`%${word}%`);
                return `(CASE WHEN LOWER(l.objeto_compra) LIKE LOWER($${idx}) THEN ${Math.round(10 / cnaeWords.length)} ELSE 0 END)`;
            }).join(' + ') + ')';
        }
    }

    // Build exclusion clause for interacted licitacoes
    let exclusionClause = '';
    if (interactedIds.length > 0) {
        const idx = paramIndex++;
        params.push(interactedIds);
        exclusionClause = ` AND l.id != ALL($${idx}::int[])`;
    }

    // Build excluded deadline filter (only show valid/future deadlines or null)
    const deadlineFilter = ` AND (l.data_encerramento_proposta > NOW() OR l.data_encerramento_proposta IS NULL)`;

    // Porte filter (limit by company size)
    let porteFilter = '';
    if (cnpjData && cnpjData.porte_empresa) {
        const porte = cnpjData.porte_empresa.toUpperCase();
        if (porte.includes('MEI')) {
            porteFilter = ' AND (l.valor_estimado_total IS NULL OR l.valor_estimado_total <= 100000)';
        } else if (porte.includes('MICRO')) {
            porteFilter = ' AND (l.valor_estimado_total IS NULL OR l.valor_estimado_total <= 500000)';
        } else if (porte.includes('PEQUENO')) {
            porteFilter = ' AND (l.valor_estimado_total IS NULL OR l.valor_estimado_total <= 2000000)';
        }
    }

    let sql = `
        SELECT l.*,
        LEAST(100, (
            ${keywordScore} +
            ${locationScore} + 
            ${modalidadeScore} +
            ${valueScore} +
            ${cnaeScore}
        )) AS relevance_score
        FROM licitacoes l
        WHERE 1=1
        ${keywordFilter}
        ${exclusionClause}
        ${deadlineFilter}
        ${porteFilter}
    `;

    // Additional filters from request
    if (filters.cnpj_orgao) {
        sql += ` AND l.cnpj_orgao = $${paramIndex++}`;
        params.push(filters.cnpj_orgao);
    }
    if (filters.modalidade) {
        sql += ` AND l.modalidade_licitacao = $${paramIndex++}`;
        params.push(filters.modalidade);
    }
    if (filters.search) {
        sql += ` AND to_tsvector('portuguese', COALESCE(l.objeto_compra, '') || ' ' || COALESCE(l.informacao_complementar, '')) @@ websearch_to_tsquery('portuguese', $${paramIndex++})`;
        params.push(filters.search);
    }

    sql += ` ORDER BY relevance_score DESC, l.data_publicacao_pncp DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const { rows } = await p.query(sql, params);

    // Enrich each row with financial metrics and deadline info
    for (const row of rows) {
        // Calculate financial metrics
        const metrics = await calculateFinancialMetrics(row.id);
        row.lucro_esperado = metrics.lucroEsperado;
        row.capital_necessario = metrics.capitalNecessario;
        row.is_valor_sigiloso = metrics.isSigiloso;

        // Calculate deadline info
        row.has_valid_deadline = isValidDeadline(row.data_encerramento_proposta);
        if (!row.has_valid_deadline) {
            const estimated = calculateEstimatedDeadline(row.data_publicacao_pncp, row.modalidade_licitacao);
            row.prazo_previsto = estimated;
        }

        // Match indicators
        const matchedKeywords = (prefs.keywords || []).filter(kw =>
            row.objeto_compra && row.objeto_compra.toLowerCase().includes(kw.toLowerCase())
        );
        row.matched_keywords = matchedKeywords.join(',');
        row.has_cnpj_match = cnpjData && row.relevance_score > 60;
    }

    return rows;
}

// --- USER SAVED LICITACOES FUNCTIONS ---

async function saveUserLicitacao(userId, licitacaoId, notes = null) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");

    try {
        await p.query(
            'INSERT INTO user_saved_licitacoes (user_id, licitacao_id, notes) VALUES ($1, $2, $3)',
            [userId, licitacaoId, notes]
        );
        return true;
    } catch (e) {
        // 23505 is unique_violation in Postgres
        if (e.code === '23505') return false;
        throw e;
    }
}

async function unsaveUserLicitacao(userId, licitacaoId) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");

    await p.query(
        'DELETE FROM user_saved_licitacoes WHERE user_id = $1 AND licitacao_id = $2',
        [userId, licitacaoId]
    );
}

async function getUserSavedLicitacoes(userId, limit = 50, offset = 0) {
    const p = await getPool();
    if (!p) return [];

    const { rows } = await p.query(
        `SELECT l.*, s.saved_at, s.notes, 0 AS relevance_score
         FROM user_saved_licitacoes s
         JOIN licitacoes l ON s.licitacao_id = l.id
         WHERE s.user_id = $1
         ORDER BY s.saved_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
    );

    return rows;
}

async function isLicitacaoSaved(userId, licitacaoId) {
    const p = await getPool();
    if (!p) return false;

    const { rows } = await p.query(
        'SELECT id FROM user_saved_licitacoes WHERE user_id = $1 AND licitacao_id = $2',
        [userId, licitacaoId]
    );

    return rows.length > 0;
}

// --- USER DISLIKED LICITACOES FUNCTIONS ---

async function dislikeUserLicitacao(userId, licitacaoId) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");

    try {
        await p.query(
            'INSERT INTO user_disliked_licitacoes (user_id, licitacao_id) VALUES ($1, $2)',
            [userId, licitacaoId]
        );
        return true;
    } catch (e) {
        if (e.code === '23505') return false;
        throw e;
    }
}

async function undislikeUserLicitacao(userId, licitacaoId) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");

    await p.query(
        'DELETE FROM user_disliked_licitacoes WHERE user_id = $1 AND licitacao_id = $2',
        [userId, licitacaoId]
    );
}

async function isLicitacaoDisliked(userId, licitacaoId) {
    const p = await getPool();
    if (!p) return false;

    const { rows } = await p.query(
        'SELECT id FROM user_disliked_licitacoes WHERE user_id = $1 AND licitacao_id = $2',
        [userId, licitacaoId]
    );

    return rows.length > 0;
}

// Search Licitacoes with Multi-Select Filters
async function searchLicitacoes(filters = {}, limit = 50, offset = 0) {
    const p = await getPool();
    if (!p) return [];

    let sql = `SELECT l.* FROM licitacoes l WHERE 1=1`;
    let params = [];
    let paramIndex = 1;

    // Keywords (OR logic)
    if (filters.keywords && Array.isArray(filters.keywords) && filters.keywords.length > 0) {
        const keywordConditions = filters.keywords.map(() => {
            const idx = paramIndex++;
            // Use ILIKE in Postgres
            return `(l.objeto_compra ILIKE $${idx} OR l.informacao_complementar ILIKE $${idx})`;
        }).join(' OR ');

        sql += ` AND (${keywordConditions})`;

        filters.keywords.forEach(kw => {
            params.push(`%${kw}%`);
        });
    }

    // Modalidades
    if (filters.modalidades && Array.isArray(filters.modalidades) && filters.modalidades.length > 0) {
        const idx = paramIndex++;
        sql += ` AND l.modalidade_licitacao = ANY($${idx}::text[])`;
        params.push(filters.modalidades);
    }

    // Estados
    if (filters.estados && Array.isArray(filters.estados) && filters.estados.length > 0) {
        const idx = paramIndex++;
        sql += ` AND l.uf_sigla = ANY($${idx}::text[])`;
        params.push(filters.estados);
    }

    // Esferas
    if (filters.esferas && Array.isArray(filters.esferas) && filters.esferas.length > 0) {
        const idx = paramIndex++;
        sql += ` AND l.esfera = ANY($${idx}::text[])`;
        params.push(filters.esferas);
    }

    sql += ` ORDER BY l.data_encerramento_proposta ASC, l.data_publicacao_pncp DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const { rows } = await p.query(sql, params);
    return rows;
}

// --- USER CNPJ DATA FUNCTIONS ---

async function createUserCNPJData(userId, cnpjData) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");

    const sql = `INSERT INTO user_cnpj_data (
        user_id, cnpj, razao_social, nome_fantasia,
        situacao_cadastral, data_situacao, matriz_filial, data_abertura,
        cnae_principal, cnae_principal_descricao, cnaes_secundarios,
        logradouro, numero, complemento, bairro, cep, municipio, uf,
        telefones, email,
        capital_social, porte_empresa, natureza_juridica,
        optante_simples, optante_mei,
        socios, raw_data
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)`;

    await p.query(sql, [
        userId,
        cnpjData.cnpj,
        cnpjData.razaoSocial,
        cnpjData.nomeFantasia,
        cnpjData.situacaoCadastral,
        cnpjData.dataSituacao,
        cnpjData.matrizFilial,
        cnpjData.dataAbertura,
        cnpjData.cnaePrincipal?.codigo,
        cnpjData.cnaePrincipal?.descricao,
        JSON.stringify(cnpjData.cnaesSecundarios || []),
        cnpjData.endereco?.logradouro,
        cnpjData.endereco?.numero,
        cnpjData.endereco?.complemento,
        cnpjData.endereco?.bairro,
        cnpjData.endereco?.cep,
        cnpjData.endereco?.municipio,
        cnpjData.endereco?.uf,
        JSON.stringify(cnpjData.contatos?.telefones || []),
        cnpjData.contatos?.email,
        cnpjData.capitalSocial || 0,
        cnpjData.porteEmpresa,
        cnpjData.naturezaJuridica,
        cnpjData.simples?.optante || false,
        cnpjData.simples?.mei || false,
        JSON.stringify(cnpjData.socios || []),
        JSON.stringify(cnpjData)
    ]);
}

async function getUserCNPJData(userId) {
    const p = await getPool();
    if (!p) return null;

    const { rows } = await p.query(
        'SELECT * FROM user_cnpj_data WHERE user_id = $1',
        [userId]
    );

    if (rows.length === 0) return null;
    return rows[0];
}

async function updateUserCNPJData(userId, cnpjData) {
    const p = await getPool();
    if (!p) throw new Error("DB not ready");

    const sql = `UPDATE user_cnpj_data SET
        cnpj = $1,
        razao_social = $2,
        nome_fantasia = $3,
        situacao_cadastral = $4,
        data_situacao = $5,
        matriz_filial = $6,
        data_abertura = $7,
        cnae_principal = $8,
        cnae_principal_descricao = $9,
        cnaes_secundarios = $10,
        logradouro = $11,
        numero = $12,
        complemento = $13,
        bairro = $14,
        cep = $15,
        municipio = $16,
        uf = $17,
        telefones = $18,
        email = $19,
        capital_social = $20,
        porte_empresa = $21,
        natureza_juridica = $22,
        optante_simples = $23,
        optante_mei = $24,
        socios = $25,
        raw_data = $26
    WHERE user_id = $27`;

    await p.query(sql, [
        cnpjData.cnpj,
        cnpjData.razaoSocial,
        cnpjData.nomeFantasia,
        cnpjData.situacaoCadastral,
        cnpjData.dataSituacao,
        cnpjData.matrizFilial,
        cnpjData.dataAbertura,
        cnpjData.cnaePrincipal?.codigo,
        cnpjData.cnaePrincipal?.descricao,
        JSON.stringify(cnpjData.cnaesSecundarios || []),
        cnpjData.endereco?.logradouro,
        cnpjData.endereco?.numero,
        cnpjData.endereco?.complemento,
        cnpjData.endereco?.bairro,
        cnpjData.endereco?.cep,
        cnpjData.endereco?.municipio,
        cnpjData.endereco?.uf,
        JSON.stringify(cnpjData.contatos?.telefones || []),
        cnpjData.contatos?.email,
        cnpjData.capitalSocial || 0,
        cnpjData.porteEmpresa,
        cnpjData.naturezaJuridica,
        cnpjData.simples?.optante || false,
        cnpjData.simples?.mei || false,
        JSON.stringify(cnpjData.socios || []),
        JSON.stringify(cnpjData),
        userId
    ]);
}

async function deleteUserCNPJData(userId) {
    const p = await getPool();
    if (!p) return;
    await p.query('DELETE FROM user_cnpj_data WHERE user_id = $1', [userId]);
}

async function updateLicitacaoRawData(id, rawItems, rawFiles) {
    const p = await getPool();
    if (!p) return;

    // Build dynamic query to update only provided fields
    const updates = [];
    const params = [id];
    let idx = 2;

    if (rawItems !== undefined) {
        updates.push(`raw_data_itens = $${idx}`);
        params.push(JSON.stringify(rawItems));
        idx++;
    }
    if (rawFiles !== undefined) {
        updates.push(`raw_data_arquivos = $${idx}`);
        params.push(JSON.stringify(rawFiles));
        idx++;
    }

    if (updates.length === 0) return;

    const sql = `UPDATE licitacoes SET ${updates.join(', ')} WHERE id = $1`;

    try {
        await p.query(sql, params);
    } catch (e) {
        console.warn(`[DB] Error saving raw data for licitacao ${id}: ${e.message}`);
    }
}

// --- USER LICITACAO INTERACTIONS FUNCTIONS ---

async function logUserInteraction(userId, licitacaoId, actionType, metadata = null) {
    const p = await getPool();
    if (!p) return;

    try {
        await p.query(
            `INSERT INTO user_licitacao_interactions (user_id, licitacao_id, action_type, metadata)
             VALUES ($1, $2, $3, $4)`,
            [userId, licitacaoId, actionType, metadata ? JSON.stringify(metadata) : null]
        );
    } catch (e) {
        console.warn(`[DB] Error logging interaction: ${e.message}`);
    }
}

async function getInteractedLicitacaoIds(userId, actionTypes = ['skip', 'save', 'dislike']) {
    const p = await getPool();
    if (!p) return [];

    // Get IDs from both interactions table AND legacy tables
    const { rows: interactionRows } = await p.query(
        `SELECT DISTINCT licitacao_id FROM user_licitacao_interactions 
         WHERE user_id = $1 AND action_type = ANY($2::text[])`,
        [userId, actionTypes]
    );

    const { rows: savedRows } = await p.query(
        `SELECT licitacao_id FROM user_saved_licitacoes WHERE user_id = $1`,
        [userId]
    );

    const { rows: dislikedRows } = await p.query(
        `SELECT licitacao_id FROM user_disliked_licitacoes WHERE user_id = $1`,
        [userId]
    );

    const allIds = new Set([
        ...interactionRows.map(r => r.licitacao_id),
        ...savedRows.map(r => r.licitacao_id),
        ...dislikedRows.map(r => r.licitacao_id)
    ]);

    return Array.from(allIds);
}

// --- FINANCIAL METRICS FUNCTIONS ---

async function calculateFinancialMetrics(licitacaoId) {
    const p = await getPool();
    if (!p) return { lucroEsperado: 0, capitalNecessario: 0, valorMaterial: 0, valorServico: 0, isSigiloso: false };

    // Get licitacao to check if sigiloso
    const { rows: licRows } = await p.query(
        'SELECT valor_estimado_total FROM licitacoes WHERE id = $1',
        [licitacaoId]
    );

    const valorTotal = licRows[0]?.valor_estimado_total;
    const isSigiloso = !valorTotal || parseFloat(valorTotal) <= 0;

    if (isSigiloso) {
        return { lucroEsperado: 0, capitalNecessario: 0, valorMaterial: 0, valorServico: 0, isSigiloso: true };
    }

    // Get items and calculate by type
    const { rows: itens } = await p.query(
        'SELECT valor_total_estimado, material_ou_servico FROM licitacoes_itens WHERE licitacao_id = $1',
        [licitacaoId]
    );

    let valorMaterial = 0, valorServico = 0;

    if (itens.length === 0) {
        // No items, use total value as material (conservative estimate)
        valorMaterial = parseFloat(valorTotal) || 0;
    } else {
        itens.forEach(item => {
            const valor = parseFloat(item.valor_total_estimado) || 0;
            if (item.material_ou_servico === 'S') {
                valorServico += valor;
            } else {
                // Default to material (M or null)
                valorMaterial += valor;
            }
        });
    }

    // Calculate metrics
    // Material: 25% profit margin, 60% capital needed
    // Service: 65% profit margin, 20% capital needed
    const lucroEsperado = (valorMaterial * 0.25) + (valorServico * 0.65);
    const capitalNecessario = (valorMaterial * 0.60) + (valorServico * 0.20);

    return {
        lucroEsperado: Math.round(lucroEsperado * 100) / 100,
        capitalNecessario: Math.round(capitalNecessario * 100) / 100,
        valorMaterial: Math.round(valorMaterial * 100) / 100,
        valorServico: Math.round(valorServico * 100) / 100,
        isSigiloso: false
    };
}

// --- DEADLINE CALCULATION FUNCTIONS ---

// Brazilian holidays for 2026 (add more years as needed)
const BRAZILIAN_HOLIDAYS_2026 = [
    '2026-01-01', // Confraternização Universal
    '2026-02-16', '2026-02-17', // Carnaval
    '2026-04-03', // Sexta-feira Santa
    '2026-04-21', // Tiradentes
    '2026-05-01', // Dia do Trabalho
    '2026-06-04', // Corpus Christi
    '2026-09-07', // Independência
    '2026-10-12', // Nossa Senhora Aparecida
    '2026-11-02', // Finados
    '2026-11-15', // Proclamação da República
    '2026-12-25'  // Natal
];

function isBusinessDay(date) {
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();

    // Weekend check
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;

    // Holiday check
    if (BRAZILIAN_HOLIDAYS_2026.includes(dateStr)) return false;

    return true;
}

function addBusinessDays(startDate, days) {
    const result = new Date(startDate);
    let addedDays = 0;

    while (addedDays < days) {
        result.setDate(result.getDate() + 1);
        if (isBusinessDay(result)) {
            addedDays++;
        }
    }

    return result;
}

function calculateEstimatedDeadline(dataPublicacao, modalidade) {
    if (!dataPublicacao) return null;

    const date = new Date(dataPublicacao);
    if (isNaN(date.getTime())) return null;

    // Dispensa: 3 business days, Pregão: 8 business days
    const businessDays = (modalidade && modalidade.toLowerCase().includes('dispensa')) ? 3 : 8;

    return addBusinessDays(date, businessDays);
}

function isValidDeadline(date) {
    if (!date) return false;
    const d = new Date(date);
    if (isNaN(d.getTime())) return false;
    // Invalid if before 2026
    if (d.getFullYear() < 2026) return false;
    return true;
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
    getBatchStatus,
    // Preferences & Personalization
    getUserLicitacoesPreferences,
    updateUserLicitacoesPreferences,
    getPersonalizedLicitacoes,
    searchLicitacoes,
    saveUserLicitacao,
    unsaveUserLicitacao,
    getUserSavedLicitacoes,
    isLicitacaoSaved,
    dislikeUserLicitacao,
    undislikeUserLicitacao,
    isLicitacaoDisliked,
    // User CNPJ Data
    createUserCNPJData,
    getUserCNPJData,
    updateUserCNPJData,
    deleteUserCNPJData,
    updateLicitacaoRawData,
    // Interactions & Analytics
    logUserInteraction,
    getInteractedLicitacaoIds,
    // Financial Metrics
    calculateFinancialMetrics,
    calculateEstimatedDeadline,
    isValidDeadline,
    getPool
};


