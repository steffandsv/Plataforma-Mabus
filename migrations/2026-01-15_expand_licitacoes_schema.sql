-- Migração: Expandir schema de licitações para capturar todos os campos da API PNCP
-- Data: 2026-01-15
-- Autor: Sistema Mabus

-- ============================================================================
-- PARTE 1: Adicionar novas colunas à tabela licitacoes
-- ============================================================================

ALTER TABLE licitacoes
-- Links (CRÍTICO - requisitado pelo usuário)
ADD COLUMN link_sistema_origem TEXT COMMENT 'URL do edital no sistema de origem',
ADD COLUMN link_processo_eletronico TEXT COMMENT 'URL do processo eletrônico',

-- Identificadores adicionais
ADD COLUMN sequencial_compra INT COMMENT 'Número sequencial da compra no órgão',

-- Datas adicionais
ADD COLUMN data_inclusao DATETIME COMMENT 'Data de inclusão no PNCP',
ADD COLUMN data_atualizacao DATETIME COMMENT 'Data da última atualização',
ADD COLUMN data_atualizacao_global DATETIME COMMENT 'Data de atualização global no PNCP',

-- Modo de Disputa
ADD COLUMN modo_disputa_id INT COMMENT 'ID do modo de disputa',
ADD COLUMN modo_disputa_nome VARCHAR(100) COMMENT 'Nome do modo de disputa',

-- Tipo de Instrumento Convocatório
ADD COLUMN tipo_instrumento_codigo INT COMMENT 'Código do tipo de instrumento',
ADD COLUMN tipo_instrumento_nome VARCHAR(200) COMMENT 'Nome do tipo de instrumento',

-- Flags
ADD COLUMN srp BOOLEAN DEFAULT FALSE COMMENT 'Sistema de Registro de Preços',

-- Usuário responsável
ADD COLUMN usuario_nome VARCHAR(255) COMMENT 'Nome do usuário que publicou',

-- Localização (expandido de unidadeOrgao)
ADD COLUMN uf_sigla CHAR(2) COMMENT 'Sigla da UF',
ADD COLUMN uf_nome VARCHAR(100) COMMENT 'Nome da UF',
ADD COLUMN municipio_nome VARCHAR(200) COMMENT 'Nome do município',
ADD COLUMN codigo_ibge VARCHAR(20) COMMENT 'Código IBGE do município',
ADD COLUMN codigo_unidade VARCHAR(50) COMMENT 'Código da unidade organizacional',
ADD COLUMN nome_unidade VARCHAR(255) COMMENT 'Nome da unidade organizacional',

-- Amparo Legal
ADD COLUMN amparo_legal_codigo INT COMMENT 'Código do amparo legal',
ADD COLUMN amparo_legal_nome TEXT COMMENT 'Nome/descrição do amparo legal',
ADD COLUMN amparo_legal_descricao TEXT COMMENT 'Descrição completa do amparo legal',

-- Metadata JSON para campos não-estruturados
ADD COLUMN metadata_json JSON COMMENT 'Campos adicionais: fontesOrcamentarias, orgaoSubRogado, etc',

-- Índices para novos campos importantes
ADD INDEX idx_uf_sigla (uf_sigla),
ADD INDEX idx_municipio (municipio_nome(100)),
ADD INDEX idx_srp (srp),
ADD INDEX idx_amparo_legal_codigo (amparo_legal_codigo);

-- ============================================================================
-- PARTE 2: Adicionar colunas à tabela licitacoes_itens
-- ============================================================================

ALTER TABLE licitacoes_itens
ADD COLUMN material_ou_servico CHAR(1) COMMENT 'M=Material, S=Serviço, O=Obras',
ADD COLUMN material_ou_servico_nome VARCHAR(50) COMMENT 'Descrição: Material, Serviço, etc';

-- ============================================================================
-- FIM DA MIGRAÇÃO
-- ============================================================================

-- Para reverter (se necessário):
-- ALTER TABLE licitacoes 
-- DROP COLUMN link_sistema_origem, DROP COLUMN link_processo_eletronico,
-- DROP COLUMN sequencial_compra, DROP COLUMN data_inclusao, DROP COLUMN data_atualizacao,
-- DROP COLUMN data_atualizacao_global, DROP COLUMN modo_disputa_id, DROP COLUMN modo_disputa_nome,
-- DROP COLUMN tipo_instrumento_codigo, DROP COLUMN tipo_instrumento_nome, DROP COLUMN srp,
-- DROP COLUMN usuario_nome, DROP COLUMN uf_sigla, DROP COLUMN uf_nome, DROP COLUMN municipio_nome,
-- DROP COLUMN codigo_ibge, DROP COLUMN codigo_unidade, DROP COLUMN nome_unidade,
-- DROP COLUMN amparo_legal_codigo, DROP COLUMN amparo_legal_nome, DROP COLUMN amparo_legal_descricao,
-- DROP COLUMN metadata_json;
--
-- ALTER TABLE licitacoes_itens
-- DROP COLUMN material_ou_servico, DROP COLUMN material_ou_servico_nome;
