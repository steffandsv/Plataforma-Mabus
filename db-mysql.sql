-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Jan 16, 2026 at 08:32 PM
-- Server version: 11.8.3-MariaDB-log
-- PHP Version: 7.2.34

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `u532133195_plataforma`
--

-- --------------------------------------------------------

--
-- Table structure for table `credits_ledger`
--

CREATE TABLE `credits_ledger` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `amount` int(11) NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `task_id` varchar(36) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `credits_ledger`
--

-- --------------------------------------------------------

--
-- Table structure for table `groups`
--

CREATE TABLE `groups` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `item_candidates`
--

CREATE TABLE `item_candidates` (
  `id` int(11) NOT NULL,
  `task_item_id` int(11) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `link` text DEFAULT NULL,
  `image_url` text DEFAULT NULL,
  `store` varchar(100) DEFAULT NULL,
  `specs` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`specs`)),
  `risk_score` varchar(50) DEFAULT NULL,
  `ai_reasoning` text DEFAULT NULL,
  `is_selected` tinyint(1) DEFAULT 0,
  `gtin` varchar(50) DEFAULT NULL,
  `manufacturer_part_number` varchar(100) DEFAULT NULL,
  `enrichment_source` varchar(50) DEFAULT NULL,
  `seller_reputation` varchar(50) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `licitacoes`
--

CREATE TABLE `licitacoes` (
  `id` int(11) NOT NULL,
  `numero_sequencial_pncp` varchar(100) NOT NULL,
  `numero_controle_pncp` varchar(255) DEFAULT NULL,
  `ano_compra` int(11) DEFAULT NULL,
  `cnpj_orgao` varchar(18) DEFAULT NULL,
  `razao_social_orgao` varchar(500) DEFAULT NULL,
  `poder` varchar(50) DEFAULT NULL,
  `esfera` varchar(50) DEFAULT NULL,
  `objeto_compra` text DEFAULT NULL,
  `informacao_complementar` text DEFAULT NULL,
  `situacao_compra` varchar(100) DEFAULT NULL,
  `modalidade_licitacao` varchar(100) DEFAULT NULL,
  `modo_disputa` varchar(100) DEFAULT NULL,
  `criterio_julgamento` varchar(100) DEFAULT NULL,
  `valor_estimado_total` decimal(15,2) DEFAULT NULL,
  `valor_total_homologado` decimal(15,2) DEFAULT NULL,
  `data_publicacao_pncp` datetime DEFAULT NULL,
  `data_abertura_proposta` datetime DEFAULT NULL,
  `data_encerramento_proposta` datetime DEFAULT NULL,
  `raw_data_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`raw_data_json`)),
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `link_sistema_origem` text DEFAULT NULL COMMENT 'URL do edital no sistema de origem',
  `link_processo_eletronico` text DEFAULT NULL COMMENT 'URL do processo eletrônico',
  `sequencial_compra` int(11) DEFAULT NULL COMMENT 'Número sequencial da compra no órgão',
  `data_inclusao` datetime DEFAULT NULL COMMENT 'Data de inclusão no PNCP',
  `data_atualizacao` datetime DEFAULT NULL COMMENT 'Data da última atualização',
  `data_atualizacao_global` datetime DEFAULT NULL COMMENT 'Data de atualização global no PNCP',
  `modo_disputa_id` int(11) DEFAULT NULL COMMENT 'ID do modo de disputa',
  `modo_disputa_nome` varchar(100) DEFAULT NULL COMMENT 'Nome do modo de disputa',
  `tipo_instrumento_codigo` int(11) DEFAULT NULL COMMENT 'Código do tipo de instrumento',
  `tipo_instrumento_nome` varchar(200) DEFAULT NULL COMMENT 'Nome do tipo de instrumento',
  `srp` tinyint(1) DEFAULT 0 COMMENT 'Sistema de Registro de Preços',
  `usuario_nome` varchar(255) DEFAULT NULL COMMENT 'Nome do usuário que publicou',
  `uf_sigla` char(2) DEFAULT NULL COMMENT 'Sigla da UF',
  `uf_nome` varchar(100) DEFAULT NULL COMMENT 'Nome da UF',
  `municipio_nome` varchar(200) DEFAULT NULL COMMENT 'Nome do município',
  `codigo_ibge` varchar(20) DEFAULT NULL COMMENT 'Código IBGE do município',
  `codigo_unidade` varchar(50) DEFAULT NULL COMMENT 'Código da unidade organizacional',
  `nome_unidade` varchar(255) DEFAULT NULL COMMENT 'Nome da unidade organizacional',
  `amparo_legal_codigo` int(11) DEFAULT NULL COMMENT 'Código do amparo legal',
  `amparo_legal_nome` text DEFAULT NULL COMMENT 'Nome/descrição do amparo legal',
  `amparo_legal_descricao` text DEFAULT NULL COMMENT 'Descrição completa do amparo legal',
  `metadata_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Campos adicionais: fontesOrcamentarias, orgaoSubRogado, etc' CHECK (json_valid(`metadata_json`)),
  `numero_compra` varchar(100) DEFAULT NULL,
  `processo` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `licitacoes`
--

-- --------------------------------------------------------

--
-- Table structure for table `licitacoes_arquivos`
--

CREATE TABLE `licitacoes_arquivos` (
  `id` int(11) NOT NULL,
  `licitacao_id` int(11) NOT NULL,
  `sequencial_documento` int(11) DEFAULT NULL,
  `titulo` varchar(500) DEFAULT NULL,
  `tipo_documento_id` int(11) DEFAULT NULL,
  `tipo_documento_nome` varchar(200) DEFAULT NULL,
  `tipo_documento_descricao` text DEFAULT NULL,
  `url` text NOT NULL,
  `data_publicacao` datetime DEFAULT NULL,
  `status_ativo` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `licitacoes_arquivos`
--

-- --------------------------------------------------------

--
-- Table structure for table `licitacoes_itens`
--

CREATE TABLE `licitacoes_itens` (
  `id` int(11) NOT NULL,
  `licitacao_id` int(11) NOT NULL,
  `numero_item` int(11) DEFAULT NULL,
  `descricao_item` text DEFAULT NULL,
  `quantidade` decimal(12,4) DEFAULT NULL,
  `unidade_medida` varchar(50) DEFAULT NULL,
  `valor_unitario_estimado` decimal(15,4) DEFAULT NULL,
  `valor_total_estimado` decimal(15,2) DEFAULT NULL,
  `codigo_catmat` varchar(50) DEFAULT NULL,
  `descricao_catmat` varchar(500) DEFAULT NULL,
  `situacao_item` varchar(100) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `material_ou_servico` char(1) DEFAULT NULL COMMENT 'M=Material, S=Serviço, O=Obras',
  `material_ou_servico_nome` varchar(50) DEFAULT NULL COMMENT 'Descrição: Material, Serviço, etc'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `licitacoes_itens`
--

-- --------------------------------------------------------

--
-- Table structure for table `licitacoes_sync_control`
--

CREATE TABLE `licitacoes_sync_control` (
  `id` int(11) NOT NULL,
  `sync_type` varchar(50) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `data_inicial` date DEFAULT NULL,
  `data_final` date DEFAULT NULL,
  `cnpj_orgao` varchar(18) DEFAULT NULL,
  `total_pages` int(11) DEFAULT NULL,
  `current_page` int(11) DEFAULT 1,
  `items_per_page` int(11) DEFAULT 500,
  `total_imported` int(11) DEFAULT 0,
  `total_duplicates` int(11) DEFAULT 0,
  `total_errors` int(11) DEFAULT 0,
  `error_message` text DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `finished_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `licitacoes_sync_control`
--

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `message` text DEFAULT NULL,
  `link` varchar(255) DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `notifications`
--

-- --------------------------------------------------------

--
-- Table structure for table `opportunities`
--

CREATE TABLE `opportunities` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `municipality` varchar(255) DEFAULT NULL,
  `metadata_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata_json`)),
  `locked_content_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`locked_content_json`)),
  `items_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`items_json`)),
  `ipm_score` int(11) DEFAULT 0,
  `status` varchar(50) DEFAULT 'available',
  `created_at` datetime DEFAULT current_timestamp(),
  `unlocked_modules` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT '[]' CHECK (json_valid(`unlocked_modules`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `opportunities`
--


-- --------------------------------------------------------

--
-- Table structure for table `settings`
--

CREATE TABLE `settings` (
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `settings`
--

INSERT INTO `settings` (`setting_key`, `setting_value`, `created_at`, `updated_at`) VALUES
('oracle_api_key', 'sk-c45addc1364c472cb67122d9103b4981', '2026-01-14 20:19:02', '2026-01-14 20:19:02'),
('oracle_model', 'qwen-max', '2026-01-14 20:19:02', '2026-01-14 20:19:02'),
('oracle_provider', 'qwen', '2026-01-14 20:19:02', '2026-01-14 20:19:02'),
('parser_backup1', '{\"provider\":\"\",\"key\":\"\",\"model\":\"\"}', '2026-01-14 20:19:02', '2026-01-14 20:19:02'),
('parser_backup2', '{\"provider\":\"\",\"key\":\"\",\"model\":\"\"}', '2026-01-14 20:19:02', '2026-01-14 20:19:02'),
('parser_backup3', '{\"provider\":\"\",\"key\":\"\",\"model\":\"\"}', '2026-01-14 20:19:03', '2026-01-14 20:19:03'),
('parser_primary', '{\"provider\":\"\",\"key\":\"\",\"model\":\"\"}', '2026-01-14 20:19:02', '2026-01-14 20:19:02');

-- --------------------------------------------------------

--
-- Table structure for table `tasks`
--

CREATE TABLE `tasks` (
  `id` varchar(36) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `cep` varchar(20) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `finished_at` datetime DEFAULT NULL,
  `input_file` varchar(255) DEFAULT NULL,
  `output_file` varchar(255) DEFAULT NULL,
  `log_file` varchar(255) DEFAULT NULL,
  `tags` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`tags`)),
  `position` int(11) DEFAULT 0,
  `external_link` text DEFAULT NULL,
  `module_name` varchar(50) DEFAULT NULL,
  `group_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `cost_estimate` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `task_items`
--

CREATE TABLE `task_items` (
  `id` int(11) NOT NULL,
  `task_id` varchar(36) NOT NULL,
  `original_id` varchar(50) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `max_price` decimal(10,2) DEFAULT NULL,
  `quantity` int(11) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'pending',
  `is_unlocked` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `task_logs`
--

CREATE TABLE `task_logs` (
  `id` int(11) NOT NULL,
  `task_id` varchar(36) NOT NULL,
  `message` text DEFAULT NULL,
  `level` varchar(20) DEFAULT 'info',
  `timestamp` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `task_metadata`
--

CREATE TABLE `task_metadata` (
  `id` int(11) NOT NULL,
  `task_id` varchar(36) NOT NULL,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`data`)),
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('user','moderator','admin') DEFAULT 'user',
  `created_at` datetime DEFAULT current_timestamp(),
  `full_name` varchar(255) DEFAULT NULL,
  `cpf` varchar(20) DEFAULT NULL,
  `cnpj` varchar(20) DEFAULT NULL,
  `current_credits` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `password_hash`, `role`, `created_at`, `full_name`, `cpf`, `cnpj`, `current_credits`) VALUES
(1, 'admin', '$2b$10$sHvGSP9wHki3kE3mPag4i.nW.6GP3VbMsOYW3AFAYNQlCtH.L.4r2', 'admin', '2026-01-14 17:14:31', NULL, NULL, NULL, 8919),
(2, 'steffan', '$2b$10$sHvGSP9wHki3kE3mPag4i.nW.6GP3VbMsOYW3AFAYNQlCtH.L.4r2', 'user', '2026-01-14 19:31:50', 'steffan', '39564151830', '56386309000116', 2147479477);

-- --------------------------------------------------------

--
-- Table structure for table `user_cnpj_data`
--

CREATE TABLE `user_cnpj_data` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `cnpj` varchar(18) NOT NULL,
  `razao_social` varchar(500) DEFAULT NULL,
  `nome_fantasia` varchar(500) DEFAULT NULL,
  `situacao_cadastral` varchar(100) DEFAULT NULL,
  `data_situacao` varchar(20) DEFAULT NULL,
  `matriz_filial` varchar(20) DEFAULT NULL,
  `data_abertura` varchar(20) DEFAULT NULL,
  `cnae_principal` varchar(20) DEFAULT NULL,
  `cnae_principal_descricao` text DEFAULT NULL,
  `cnaes_secundarios` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`cnaes_secundarios`)),
  `logradouro` varchar(500) DEFAULT NULL,
  `numero` varchar(50) DEFAULT NULL,
  `complemento` varchar(200) DEFAULT NULL,
  `bairro` varchar(200) DEFAULT NULL,
  `cep` varchar(20) DEFAULT NULL,
  `municipio` varchar(200) DEFAULT NULL,
  `uf` varchar(2) DEFAULT NULL,
  `telefones` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`telefones`)),
  `email` varchar(200) DEFAULT NULL,
  `capital_social` decimal(15,2) DEFAULT NULL,
  `porte_empresa` varchar(50) DEFAULT NULL,
  `natureza_juridica` varchar(200) DEFAULT NULL,
  `optante_simples` tinyint(1) DEFAULT 0,
  `optante_mei` tinyint(1) DEFAULT 0,
  `socios` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`socios`)),
  `raw_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`raw_data`)),
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `user_cnpj_data`
--

-- --------------------------------------------------------

--
-- Table structure for table `user_disliked_licitacoes`
--

CREATE TABLE `user_disliked_licitacoes` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `licitacao_id` int(11) NOT NULL,
  `disliked_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `user_disliked_licitacoes`
--

-- --------------------------------------------------------

--
-- Table structure for table `user_groups`
--

CREATE TABLE `user_groups` (
  `user_id` int(11) NOT NULL,
  `group_id` int(11) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_licitacoes_preferences`
--

CREATE TABLE `user_licitacoes_preferences` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `keywords` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`keywords`)),
  `preferred_ufs` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`preferred_ufs`)),
  `preferred_municipios` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`preferred_municipios`)),
  `preferred_modalidades` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`preferred_modalidades`)),
  `min_value` decimal(15,2) DEFAULT NULL,
  `max_value` decimal(15,2) DEFAULT NULL,
  `preferred_esferas` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`preferred_esferas`)),
  `preferred_poderes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`preferred_poderes`)),
  `default_view_mode` varchar(20) DEFAULT 'story',
  `cards_per_row` int(11) DEFAULT 3,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `user_licitacoes_preferences`
--

-- --------------------------------------------------------

--
-- Table structure for table `user_saved_licitacoes`
--

CREATE TABLE `user_saved_licitacoes` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `licitacao_id` int(11) NOT NULL,
  `saved_at` datetime DEFAULT current_timestamp(),
  `notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `credits_ledger`
--
ALTER TABLE `credits_ledger`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `groups`
--
ALTER TABLE `groups`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `item_candidates`
--
ALTER TABLE `item_candidates`
  ADD PRIMARY KEY (`id`),
  ADD KEY `task_item_id` (`task_item_id`);

--
-- Indexes for table `licitacoes`
--
ALTER TABLE `licitacoes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `numero_sequencial_pncp` (`numero_sequencial_pncp`),
  ADD KEY `idx_cnpj` (`cnpj_orgao`),
  ADD KEY `idx_data_pub` (`data_publicacao_pncp`),
  ADD KEY `idx_situacao` (`situacao_compra`),
  ADD KEY `idx_modalidade` (`modalidade_licitacao`),
  ADD KEY `idx_uf_sigla` (`uf_sigla`),
  ADD KEY `idx_municipio` (`municipio_nome`(100)),
  ADD KEY `idx_srp` (`srp`),
  ADD KEY `idx_amparo_legal_codigo` (`amparo_legal_codigo`);
ALTER TABLE `licitacoes` ADD FULLTEXT KEY `ft_objeto` (`objeto_compra`,`informacao_complementar`);

--
-- Indexes for table `licitacoes_arquivos`
--
ALTER TABLE `licitacoes_arquivos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_licitacao` (`licitacao_id`),
  ADD KEY `idx_tipo` (`tipo_documento_id`);

--
-- Indexes for table `licitacoes_itens`
--
ALTER TABLE `licitacoes_itens`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_licitacao` (`licitacao_id`);

--
-- Indexes for table `licitacoes_sync_control`
--
ALTER TABLE `licitacoes_sync_control`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `opportunities`
--
ALTER TABLE `opportunities`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `settings`
--
ALTER TABLE `settings`
  ADD PRIMARY KEY (`setting_key`);

--
-- Indexes for table `tasks`
--
ALTER TABLE `tasks`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `task_items`
--
ALTER TABLE `task_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `task_id` (`task_id`);

--
-- Indexes for table `task_logs`
--
ALTER TABLE `task_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `task_id` (`task_id`);

--
-- Indexes for table `task_metadata`
--
ALTER TABLE `task_metadata`
  ADD PRIMARY KEY (`id`),
  ADD KEY `task_id` (`task_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- Indexes for table `user_cnpj_data`
--
ALTER TABLE `user_cnpj_data`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_id` (`user_id`),
  ADD KEY `idx_cnpj` (`cnpj`),
  ADD KEY `idx_cnae_principal` (`cnae_principal`);

--
-- Indexes for table `user_disliked_licitacoes`
--
ALTER TABLE `user_disliked_licitacoes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_dislike` (`user_id`,`licitacao_id`),
  ADD KEY `licitacao_id` (`licitacao_id`);

--
-- Indexes for table `user_groups`
--
ALTER TABLE `user_groups`
  ADD PRIMARY KEY (`user_id`,`group_id`),
  ADD KEY `group_id` (`group_id`);

--
-- Indexes for table `user_licitacoes_preferences`
--
ALTER TABLE `user_licitacoes_preferences`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_user` (`user_id`);

--
-- Indexes for table `user_saved_licitacoes`
--
ALTER TABLE `user_saved_licitacoes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_save` (`user_id`,`licitacao_id`),
  ADD KEY `licitacao_id` (`licitacao_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `credits_ledger`
--
ALTER TABLE `credits_ledger`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=29;

--
-- AUTO_INCREMENT for table `groups`
--
ALTER TABLE `groups`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `item_candidates`
--
ALTER TABLE `item_candidates`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `licitacoes`
--
ALTER TABLE `licitacoes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=51;

--
-- AUTO_INCREMENT for table `licitacoes_arquivos`
--
ALTER TABLE `licitacoes_arquivos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=66;

--
-- AUTO_INCREMENT for table `licitacoes_itens`
--
ALTER TABLE `licitacoes_itens`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=275;

--
-- AUTO_INCREMENT for table `licitacoes_sync_control`
--
ALTER TABLE `licitacoes_sync_control`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `opportunities`
--
ALTER TABLE `opportunities`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `task_items`
--
ALTER TABLE `task_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `task_logs`
--
ALTER TABLE `task_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `task_metadata`
--
ALTER TABLE `task_metadata`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `user_cnpj_data`
--
ALTER TABLE `user_cnpj_data`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `user_disliked_licitacoes`
--
ALTER TABLE `user_disliked_licitacoes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `user_licitacoes_preferences`
--
ALTER TABLE `user_licitacoes_preferences`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `user_saved_licitacoes`
--
ALTER TABLE `user_saved_licitacoes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `credits_ledger`
--
ALTER TABLE `credits_ledger`
  ADD CONSTRAINT `credits_ledger_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `item_candidates`
--
ALTER TABLE `item_candidates`
  ADD CONSTRAINT `item_candidates_ibfk_1` FOREIGN KEY (`task_item_id`) REFERENCES `task_items` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `licitacoes_arquivos`
--
ALTER TABLE `licitacoes_arquivos`
  ADD CONSTRAINT `licitacoes_arquivos_ibfk_1` FOREIGN KEY (`licitacao_id`) REFERENCES `licitacoes` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `licitacoes_itens`
--
ALTER TABLE `licitacoes_itens`
  ADD CONSTRAINT `licitacoes_itens_ibfk_1` FOREIGN KEY (`licitacao_id`) REFERENCES `licitacoes` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `opportunities`
--
ALTER TABLE `opportunities`
  ADD CONSTRAINT `opportunities_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `task_items`
--
ALTER TABLE `task_items`
  ADD CONSTRAINT `task_items_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `task_logs`
--
ALTER TABLE `task_logs`
  ADD CONSTRAINT `task_logs_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `task_metadata`
--
ALTER TABLE `task_metadata`
  ADD CONSTRAINT `task_metadata_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_cnpj_data`
--
ALTER TABLE `user_cnpj_data`
  ADD CONSTRAINT `user_cnpj_data_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_disliked_licitacoes`
--
ALTER TABLE `user_disliked_licitacoes`
  ADD CONSTRAINT `user_disliked_licitacoes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `user_disliked_licitacoes_ibfk_2` FOREIGN KEY (`licitacao_id`) REFERENCES `licitacoes` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_groups`
--
ALTER TABLE `user_groups`
  ADD CONSTRAINT `user_groups_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `user_groups_ibfk_2` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_licitacoes_preferences`
--
ALTER TABLE `user_licitacoes_preferences`
  ADD CONSTRAINT `user_licitacoes_preferences_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_saved_licitacoes`
--
ALTER TABLE `user_saved_licitacoes`
  ADD CONSTRAINT `user_saved_licitacoes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `user_saved_licitacoes_ibfk_2` FOREIGN KEY (`licitacao_id`) REFERENCES `licitacoes` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
