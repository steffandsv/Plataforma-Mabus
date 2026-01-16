# Guia Completo: Implementação de Módulo de Consulta CNPJ em Node.js

## Índice
1. [Introdução](#introdução)
2. [APIs Gratuitas Disponíveis](#apis-gratuitas-disponíveis)
3. [Configuração Inicial](#configuração-inicial)
4. [Implementação com OpenCNPJ](#implementação-com-opencnpj)
5. [Implementação com CNPJ.ws (Publica)](#implementação-com-cnpjws-publica)
6. [Implementação com CNPJá SDK](#implementação-com-cnpjá-sdk)
7. [Tratamento de Erros e Rate Limiting](#tratamento-de-erros-e-rate-limiting)
8. [Exemplos Práticos](#exemplos-práticos)
9. [Comparativo de APIs](#comparativo-de-apis)

---

## Introdução

Este guia fornece instruções detalhadas para implementar um módulo de consulta CNPJ em Node.js, utilizando APIs públicas gratuitas. Os dados retornados incluem informações básicas como:

- Razão social
- Nome fantasia
- CNAE (Classificação Nacional de Atividades Econômicas)
- Situação cadastral
- Endereço completo
- Contatos (telefone, email)
- Dados de sócios
- Inscrições estaduais
- Regime tributário (Simples Nacional, MEI)

Todas as APIs utilizam dados públicos da Receita Federal do Brasil.

---

## APIs Gratuitas Disponíveis

### 1. OpenCNPJ (Recomendado para Simplicidade)

**URL:** `https://api.opencnpj.org/`

**Características:**
- ✅ 100% gratuita, sem autenticação
- ✅ Limite: 50 requisições/segundo por IP
- ✅ Resposta rápida (~150ms em MISS, ~40ms em HIT)
- ✅ Dados atualizados mensalmente
- ✅ Aceita CNPJ com ou sem formatação
- ❌ Não oferece plano pago

**Dados fornecidos:**
- Cadastro básico (razão social, nome fantasia)
- CNAEs (principal e secundários)
- Situação cadastral
- Endereço completo
- Contatos (telefone, email)
- Sócios (com dados mascarados de PF)
- Simples Nacional/MEI
- Inscrições estaduais
- Capital social
- Porte da empresa

### 2. CNPJ.ws (API Pública)

**URL:** `https://publica.cnpj.ws/cnpj/`

**Características:**
- ✅ Gratuita (versão pública)
- ✅ Limite: 3 consultas/minuto por IP
- ✅ Sem autenticação necessária
- ✅ Resposta em JSON
- ⚠️ Limite mais restritivo que OpenCNPJ
- ✅ Opção de upgrade para API comercial

**Dados fornecidos:** Similares ao OpenCNPJ

### 3. CNPJá SDK (Mais Completo)

**URL:** `https://cnpja.com/api/`

**Características:**
- ✅ SDK oficial para Node.js
- ✅ API Pública: 5 consultas/minuto
- ✅ API Comercial: Tempo real, mais dados
- ✅ Suporta múltiplos portais (Receita Federal, Simples, SUFRAMA)
- ✅ Filtros avançados para pesquisa
- ❌ Requer instalação de dependência

**Dados fornecidos:**
- Receita Federal (cadastro, sócios, atividades)
- Simples Nacional
- Cadastro Centralizado de Contribuintes (CCC)
- SUFRAMA
- Geocodificação (com API comercial)

---

## Configuração Inicial

### Requisitos do Projeto

```bash
# Versão mínima do Node.js
node --version  # v18.0.0 ou superior

# Gerenciador de pacotes
npm --version   # ou yarn, pnpm
```

### Estrutura de Diretórios Recomendada

```
seu-projeto/
├── src/
│   ├── modules/
│   │   └── cnpj/
│   │       ├── cnpj.service.js
│   │       ├── cnpj.controller.js
│   │       ├── cnpj.routes.js
│   │       └── utils/
│   │           ├── validators.js
│   │           ├── formatters.js
│   │           └── error-handlers.js
│   ├── config/
│   │   └── api.config.js
│   └── app.js
├── package.json
└── .env
```

### Instalação de Dependências

```bash
# Dependências básicas
npm install axios dotenv

# Dependências opcionais (para logging e tratamento de erros)
npm install winston axios-retry

# Se usar CNPJá SDK (alternativa)
npm install @cnpja/sdk
```

**package.json:**

```json
{
  "name": "cnpj-lookup-service",
  "version": "1.0.0",
  "description": "Módulo de consulta CNPJ para Node.js",
  "main": "src/app.js",
  "scripts": {
    "start": "node src/app.js",
    "dev": "nodemon src/app.js"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "dotenv": "^16.0.0",
    "winston": "^3.10.0",
    "axios-retry": "^2.8.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
```

### Arquivo .env

```env
# Configuração de APIs
CNPJ_API_PROVIDER=opencnpj  # opencnpj | cnpj_ws | cnpja
CNPJ_API_TIMEOUT=5000
CNPJ_RATE_LIMIT_ENABLED=true

# Apenas para CNPJá comercial (opcional)
CNPJA_API_KEY=sua_chave_aqui

# Logging
LOG_LEVEL=info
```

---

## Implementação com OpenCNPJ

### Opção 1: Implementação Manual com Axios

**Arquivo: `src/modules/cnpj/cnpj.service.js`**

```javascript
const axios = require('axios');
const axiosRetry = require('axios-retry');
const logger = require('../../config/logger');

// Configurar retry automático
axiosRetry(axios, { 
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
           error.response?.status === 429; // Rate limit
  }
});

class CNPJService {
  constructor() {
    this.baseUrl = 'https://api.opencnpj.org';
    this.timeout = parseInt(process.env.CNPJ_API_TIMEOUT || 5000);
  }

  /**
   * Valida o formato do CNPJ
   * @param {string} cnpj - CNPJ com ou sem formatação
   * @returns {boolean} Verdadeiro se CNPJ válido
   */
  validarCNPJ(cnpj) {
    if (!cnpj) return false;
    
    // Remove formatação
    const numeros = cnpj.replace(/\D/g, '');
    
    // Verifica se tem 14 dígitos
    if (numeros.length !== 14) return false;
    
    // Verifica se não é sequência repetida
    if (/^(\d)\1{13}$/.test(numeros)) return false;
    
    // Validação de dígito verificador (opcional, para máxima precisão)
    return true;
  }

  /**
   * Formata CNPJ para requisição (apenas números)
   * @param {string} cnpj - CNPJ com ou sem formatação
   * @returns {string} CNPJ com apenas números
   */
  formatarCNPJ(cnpj) {
    return cnpj.replace(/\D/g, '');
  }

  /**
   * Consulta dados completos do CNPJ na API OpenCNPJ
   * @param {string} cnpj - CNPJ com ou sem formatação
   * @returns {Promise<Object>} Dados da empresa
   * @throws {Error} Se CNPJ inválido ou não encontrado
   */
  async consultarCNPJ(cnpj) {
    try {
      // Validar formato
      if (!this.validarCNPJ(cnpj)) {
        const erro = new Error('CNPJ inválido ou em formato incorreto');
        erro.codigo = 'CNPJ_INVALIDO';
        throw erro;
      }

      // Formatar CNPJ para requisição
      const cnpjFormatado = this.formatarCNPJ(cnpj);

      logger.info(`Consultando CNPJ: ${cnpjFormatado}`);

      // Fazer requisição à API
      const resposta = await axios.get(
        `${this.baseUrl}/${cnpjFormatado}`,
        {
          timeout: this.timeout,
          headers: {
            'User-Agent': 'NodeJS-CNPJ-Module/1.0',
            'Accept': 'application/json'
          }
        }
      );

      // Transformar dados para formato padronizado
      return this._transformarDados(resposta.data);

    } catch (erro) {
      return this._tratarErro(erro, cnpj);
    }
  }

  /**
   * Transforma dados brutos da API para formato padronizado
   * @private
   */
  _transformarDados(dados) {
    return {
      cnpj: dados.cnpj,
      razaoSocial: dados.razao_social || dados.nome_fantasia,
      nomeFantasia: dados.nome_fantasia,
      situacaoCadastral: dados.situacao_cadastral,
      dataSituacao: dados.data_situacao_cadastral,
      matrizFilial: dados.matriz_filial,
      dataAbertura: dados.data_inicio_atividade,
      
      // CNAEs
      cnaePrincipal: {
        codigo: dados.cnae_principal,
        descricao: this._obterDescricaoCNAE(dados.cnae_principal)
      },
      cnaesSecundarios: (dados.cnaes_secundarios || []).map(codigo => ({
        codigo,
        descricao: this._obterDescricaoCNAE(codigo)
      })),

      // Endereço
      endereco: {
        logradouro: dados.logradouro,
        numero: dados.numero,
        complemento: dados.complemento,
        bairro: dados.bairro,
        cep: dados.cep,
        municipio: dados.municipio,
        uf: dados.uf
      },

      // Contatos
      contatos: {
        telefones: (dados.telefones || []).map(tel => ({
          ddd: tel.ddd,
          numero: tel.numero,
          tipo: tel.is_fax ? 'fax' : 'comercial'
        })),
        email: dados.email
      },

      // Informações comerciais
      capitalSocial: parseFloat(
        (dados.capital_social || '0').replace(',', '.')
      ),
      porteEmpresa: dados.porte_empresa,
      naturezaJuridica: dados.natureza_juridica,

      // Simples Nacional e MEI
      simples: {
        optante: dados.opcao_simples !== null,
        dataOpcao: dados.data_opcao_simples,
        mei: dados.opcao_mei !== null,
        dataMEI: dados.data_opcao_mei
      },

      // Sócios (PF com dados mascarados por privacidade)
      socios: (dados.QSA || []).map(socio => ({
        nome: socio.nome_socio,
        cpfCnpj: socio.cnpj_cpf_socio, // Mascarado: ***000000**
        qualificacao: socio.qualificacao_socio,
        dataEntrada: socio.data_entrada_sociedade,
        tipo: socio.identificador_socio,
        faixaEtaria: socio.faixa_etaria
      })),

      // Inscrições estaduais
      inscricaoEstadual: dados.inscricao_estadual,

      // Metadata
      consultadoEm: new Date().toISOString()
    };
  }

  /**
   * Obtém descrição do CNAE (implementação simplificada)
   * Em produção, usar tabela CNAE completa
   * @private
   */
  _obterDescricaoCNAE(codigo) {
    // Map simplificado - em produção usar banco de dados
    const tabelaCNAE = {
      '0111301': 'Cultivo de milho',
      '0132300': 'Cultivo de cacau',
      '4711301': 'Comércio de varejo de roupas',
      '4722801': 'Comércio de varejo de alimentos - hipermercados'
      // ... adicionar mais códigos conforme necessário
    };
    
    return tabelaCNAE[codigo] || 'CNAE não catalogado';
  }

  /**
   * Trata erros de requisição
   * @private
   */
  _tratarErro(erro, cnpj) {
    logger.error(`Erro ao consultar CNPJ ${cnpj}:`, erro.message);

    if (erro.response?.status === 404) {
      const erro404 = new Error(
        `CNPJ ${cnpj} não encontrado na base de dados`
      );
      erro404.codigo = 'CNPJ_NAO_ENCONTRADO';
      erro404.status = 404;
      throw erro404;
    }

    if (erro.response?.status === 429) {
      const erroLimite = new Error('Limite de requisições excedido');
      erroLimite.codigo = 'RATE_LIMIT_EXCEDIDO';
      erroLimite.status = 429;
      throw erroLimite;
    }

    if (erro.code === 'ECONNABORTED') {
      const erroTimeout = new Error('Requisição expirou (timeout)');
      erroTimeout.codigo = 'TIMEOUT';
      erroTimeout.status = 504;
      throw erroTimeout;
    }

    // Re-lançar erros customizados
    if (erro.codigo) throw erro;

    // Erro genérico
    const erroGenerico = new Error(
      `Erro ao consultar CNPJ: ${erro.message}`
    );
    erroGenerico.codigo = 'ERRO_GERAL';
    erroGenerico.status = 500;
    throw erroGenerico;
  }

  /**
   * Consulta múltiplos CNPJs (com retry e delay)
   * @param {string[]} cnpjs - Array de CNPJs
   * @param {number} delayMs - Delay entre requisições (padrão 500ms)
   * @returns {Promise<Object[]>} Array de resultados
   */
  async consultarMultiplos(cnpjs, delayMs = 500) {
    const resultados = [];
    
    for (let i = 0; i < cnpjs.length; i++) {
      try {
        const resultado = await this.consultarCNPJ(cnpjs[i]);
        resultados.push({
          cnpj: cnpjs[i],
          sucesso: true,
          dados: resultado
        });
      } catch (erro) {
        resultados.push({
          cnpj: cnpjs[i],
          sucesso: false,
          erro: erro.message,
          codigo: erro.codigo
        });
      }

      // Delay entre requisições para respeitar rate limit
      if (i < cnpjs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return resultados;
  }
}

module.exports = new CNPJService();
```

### Utilização do Serviço

**Arquivo: `src/modules/cnpj/cnpj.controller.js`**

```javascript
const cnpjService = require('./cnpj.service');

class CNPJController {
  async consultarCNPJ(req, res, next) {
    try {
      const { cnpj } = req.body;

      const dados = await cnpjService.consultarCNPJ(cnpj);

      res.status(200).json({
        sucesso: true,
        dados,
        timestamp: new Date().toISOString()
      });

    } catch (erro) {
      next(erro);
    }
  }

  async consultarMultiplos(req, res, next) {
    try {
      const { cnpjs } = req.body;

      if (!Array.isArray(cnpjs)) {
        return res.status(400).json({
          sucesso: false,
          erro: 'cnpjs deve ser um array'
        });
      }

      const resultados = await cnpjService.consultarMultiplos(cnpjs);

      res.status(200).json({
        sucesso: true,
        total: cnpjs.length,
        sucessos: resultados.filter(r => r.sucesso).length,
        falhas: resultados.filter(r => !r.sucesso).length,
        resultados
      });

    } catch (erro) {
      next(erro);
    }
  }
}

module.exports = new CNPJController();
```

**Arquivo: `src/modules/cnpj/cnpj.routes.js`**

```javascript
const express = require('express');
const router = express.Router();
const cnpjController = require('./cnpj.controller');

// POST /api/cnpj/consultar
router.post('/consultar', (req, res, next) => {
  cnpjController.consultarCNPJ(req, res, next);
});

// POST /api/cnpj/consultar-multiplos
router.post('/consultar-multiplos', (req, res, next) => {
  cnpjController.consultarMultiplos(req, res, next);
});

module.exports = router;
```

---

## Implementação com CNPJ.ws (Publica)

### Usando API Pública CNPJ.ws

**Arquivo: `src/modules/cnpj/cnpj.ws.service.js`**

```javascript
const axios = require('axios');
const logger = require('../../config/logger');

class CNPJWSService {
  constructor() {
    this.baseUrl = 'https://publica.cnpj.ws/cnpj';
    this.timeout = 5000;
    
    // Rate limit: 3 consultas por minuto
    this.ultimaRequisicao = 0;
    this.intervaloMinimo = 20000; // 20 segundos para ser conservador
  }

  /**
   * Aguarda respeitando rate limit
   * @private
   */
  async aguardarRateLimit() {
    const tempoDecorrido = Date.now() - this.ultimaRequisicao;
    if (tempoDecorrido < this.intervaloMinimo) {
      const delay = this.intervaloMinimo - tempoDecorrido;
      logger.debug(`Aguardando ${delay}ms por rate limit`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  /**
   * Consulta CNPJ na API CNPJ.ws
   */
  async consultarCNPJ(cnpj) {
    try {
      // Aguardar rate limit
      await this.aguardarRateLimit();

      const cnpjLimpo = cnpj.replace(/\D/g, '');
      
      logger.info(`Consultando CNPJ.ws: ${cnpjLimpo}`);

      const resposta = await axios.get(
        `${this.baseUrl}/${cnpjLimpo}`,
        {
          timeout: this.timeout,
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      this.ultimaRequisicao = Date.now();

      return this._transformarDados(resposta.data);

    } catch (erro) {
      if (erro.response?.status === 404) {
        throw new Error(`CNPJ ${cnpj} não encontrado`);
      }
      if (erro.response?.status === 429) {
        throw new Error('Limite de requisições excedido. Aguarde antes de tentar novamente');
      }
      throw erro;
    }
  }

  /**
   * Transforma dados da resposta CNPJ.ws
   * @private
   */
  _transformarDados(dados) {
    return {
      cnpj: dados.cnpj,
      razaoSocial: dados.razao_social,
      nomeFantasia: dados.nome_fantasia,
      situacaoCadastral: dados.situacao_cadastral,
      dataAbertura: dados.data_abertura,
      
      cnaePrincipal: {
        codigo: dados.cnae_principal,
        descricao: dados.descricao_cnae
      },

      endereco: {
        logradouro: dados.logradouro,
        numero: dados.numero,
        complemento: dados.complemento,
        bairro: dados.bairro,
        cep: dados.cep,
        municipio: dados.municipio,
        uf: dados.uf
      },

      contatos: {
        telefone: dados.telefone,
        email: dados.email
      }
    };
  }
}

module.exports = new CNPJWSService();
```

---

## Implementação com CNPJá SDK

### Usando SDK Oficial do CNPJá

**Instalação:**

```bash
npm install @cnpja/sdk
```

**Arquivo: `src/modules/cnpj/cnpja.service.js`**

```javascript
const { CnpjaOpen, Cnpja } = require('@cnpja/sdk');
const logger = require('../../config/logger');

class CNPJaService {
  constructor() {
    // API Pública (sem autenticação)
    this.cnpjaPublica = new CnpjaOpen();
    
    // API Comercial (opcional, requer chave)
    if (process.env.CNPJA_API_KEY) {
      this.cnpjaComercial = new Cnpja({ 
        apiKey: process.env.CNPJA_API_KEY 
      });
    }
  }

  /**
   * Consulta CNPJ usando API Pública (5 req/min)
   */
  async consultarPublica(cnpj) {
    try {
      logger.info(`Consultando CNPJá Pública: ${cnpj}`);

      const dados = await this.cnpjaPublica.office.read({
        taxId: cnpj.replace(/\D/g, '')
      });

      return this._transformarDados(dados);

    } catch (erro) {
      logger.error('Erro na API CNPJá Pública:', erro.message);
      throw erro;
    }
  }

  /**
   * Consulta com dados enriquecidos (API Comercial)
   * Inclui Receita Federal, Simples Nacional, SUFRAMA, etc
   */
  async consultarCompleta(cnpj) {
    if (!this.cnpjaComercial) {
      throw new Error('API Comercial do CNPJá não configurada');
    }

    try {
      const cnpjLimpo = cnpj.replace(/\D/g, '');
      logger.info(`Consultando CNPJá Comercial: ${cnpjLimpo}`);

      // Receita Federal
      const rfb = await this.cnpjaComercial.rfb.read({
        taxId: cnpjLimpo,
        strategy: 'CACHE_IF_ERROR',
        maxAge: 45
      });

      // Simples Nacional
      const simples = await this.cnpjaComercial.simples.read({
        taxId: cnpjLimpo,
        strategy: 'CACHE_IF_ERROR'
      });

      // CCC (Cadastro Centralizado de Contribuintes)
      const ccc = await this.cnpjaComercial.ccc.read({
        taxId: cnpjLimpo,
        states: ['BR'] // Todos os estados
      });

      return {
        rfb,
        simples,
        ccc
      };

    } catch (erro) {
      logger.error('Erro na API CNPJá Comercial:', erro.message);
      throw erro;
    }
  }

  /**
   * Pesquisa empresas por filtros (API Comercial)
   * Exemplo: empresas abertas nos últimos 30 dias em SP
   */
  async pesquisarEmpresas(filtros) {
    if (!this.cnpjaComercial) {
      throw new Error('API Comercial do CNPJá não configurada');
    }

    try {
      const resultados = [];
      
      for await (const offices of this.cnpjaComercial.office.search(filtros)) {
        resultados.push(...offices);
      }

      return resultados;

    } catch (erro) {
      logger.error('Erro ao pesquisar empresas:', erro.message);
      throw erro;
    }
  }

  /**
   * Exemplo: Pesquisar microempresas abertas nos últimos 30 dias em SP
   */
  async pesquisarMicroempresasRecentes() {
    const dataUmMesAtras = new Date();
    dataUmMesAtras.setDate(dataUm MesAtras.getDate() - 30);

    return this.pesquisarEmpresas({
      'company.size.id.in': [1], // Microempresa
      'address.state.in': ['SP'],
      'founded.gte': dataUm MesAtras.toISOString().split('T')[0],
      'founded.lte': new Date().toISOString().split('T')[0],
      limit: 100
    });
  }

  /**
   * Obter comprovante em PDF (API Comercial)
   */
  async obterComprovantePDF(cnpj) {
    if (!this.cnpjaComercial) {
      throw new Error('API Comercial do CNPJá não configurada');
    }

    try {
      const pdfBuffer = await this.cnpjaComercial.rfb.certificate({
        taxId: cnpj.replace(/\D/g, ''),
        pages: ['REGISTRATION', 'MEMBERS']
      });

      return pdfBuffer;

    } catch (erro) {
      logger.error('Erro ao gerar PDF:', erro.message);
      throw erro;
    }
  }

  /**
   * Transforma dados da resposta
   * @private
   */
  _transformarDados(dados) {
    return {
      cnpj: dados.cnpj,
      razaoSocial: dados.razao_social,
      nomeFantasia: dados.nome_fantasia,
      situacaoCadastral: dados.situacao_cadastral,
      dataAbertura: dados.data_inicio_atividade,
      
      cnaePrincipal: {
        codigo: dados.cnae_principal,
        descricao: dados.descricao_cnae
      },

      endereco: {
        logradouro: dados.logradouro,
        numero: dados.numero,
        complemento: dados.complemento,
        bairro: dados.bairro,
        cep: dados.cep,
        municipio: dados.municipio,
        uf: dados.uf
      },

      contatos: {
        telefone: dados.telefone,
        email: dados.email
      },

      socios: (dados.sócios || []).map(socio => ({
        nome: socio.nome_socio,
        qualificacao: socio.qualificacao_socio,
        dataEntrada: socio.data_entrada_sociedade
      }))
    };
  }
}

module.exports = new CNPJaService();
```

---

## Tratamento de Erros e Rate Limiting

### Sistema de Retry com Backoff Exponencial

**Arquivo: `src/utils/retry.js`**

```javascript
const logger = require('../config/logger');

/**
 * Executa função com retry automático
 * @param {Function} fn - Função async a executar
 * @param {number} tentativas - Número de tentativas (padrão: 3)
 * @param {number} delayInicial - Delay inicial em ms (padrão: 1000)
 */
async function executarComRetry(fn, tentativas = 3, delayInicial = 1000) {
  let ultimoErro;

  for (let i = 0; i < tentativas; i++) {
    try {
      return await fn();
    } catch (erro) {
      ultimoErro = erro;

      // Não fazer retry para certos erros
      if (erro.status === 404 || erro.status === 400) {
        throw erro;
      }

      if (i < tentativas - 1) {
        const delay = delayInicial * Math.pow(2, i); // Backoff exponencial
        logger.warn(
          `Tentativa ${i + 1}/${tentativas} falhou. ` +
          `Aguardando ${delay}ms antes de tentar novamente...`,
          { erro: erro.message }
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw ultimoErro;
}

module.exports = { executarComRetry };
```

### Middleware de Tratamento de Erros

**Arquivo: `src/middleware/errorHandler.js`**

```javascript
const logger = require('../config/logger');

const erroHTTP = {
  'CNPJ_INVALIDO': { status: 400, mensagem: 'CNPJ em formato inválido' },
  'CNPJ_NAO_ENCONTRADO': { status: 404, mensagem: 'CNPJ não encontrado' },
  'RATE_LIMIT_EXCEDIDO': { status: 429, mensagem: 'Limite de requisições excedido' },
  'TIMEOUT': { status: 504, mensagem: 'Requisição expirou' },
  'ERRO_GERAL': { status: 500, mensagem: 'Erro interno do servidor' }
};

function tratarErro(erro, req, res, next) {
  const config = erroHTTP[erro.codigo] || erroHTTP['ERRO_GERAL'];

  logger.error('Erro não tratado:', {
    codigo: erro.codigo,
    mensagem: erro.message,
    status: config.status,
    stack: erro.stack
  });

  res.status(config.status).json({
    sucesso: false,
    erro: config.mensagem,
    codigo: erro.codigo,
    detalhes: process.env.NODE_ENV === 'development' ? erro.message : undefined
  });
}

module.exports = tratarErro;
```

### Cache com TTL (Time To Live)

**Arquivo: `src/utils/cache.js`**

```javascript
class Cache {
  constructor(ttlMs = 3600000) { // 1 hora padrão
    this.dados = new Map();
    this.ttl = ttlMs;
  }

  obter(chave) {
    const item = this.dados.get(chave);
    
    if (!item) return null;
    
    // Verificar se expirou
    if (Date.now() > item.expiracao) {
      this.dados.delete(chave);
      return null;
    }

    return item.valor;
  }

  definir(chave, valor) {
    this.dados.set(chave, {
      valor,
      expiracao: Date.now() + this.ttl
    });
  }

  limpar() {
    this.dados.clear();
  }

  limparExpirados() {
    for (const [chave, item] of this.dados) {
      if (Date.now() > item.expiracao) {
        this.dados.delete(chave);
      }
    }
  }

  tamanho() {
    return this.dados.size;
  }
}

// Singleton cache com 1 hora de TTL
module.exports = new Cache(3600000);
```

**Usar cache no serviço:**

```javascript
const cache = require('../../utils/cache');

async consultarCNPJ(cnpj) {
  const chaveCache = `cnpj_${cnpj.replace(/\D/g, '')}`;
  
  // Verificar cache
  const dados = cache.obter(chaveCache);
  if (dados) {
    logger.info(`Dados obtidos do cache: ${cnpj}`);
    return dados;
  }

  // Fazer requisição
  const resposta = await axios.get(`${this.baseUrl}/${cnpjLimpo}`);
  const dadosTransformados = this._transformarDados(resposta.data);

  // Armazenar no cache
  cache.definir(chaveCache, dadosTransformados);

  return dadosTransformados;
}
```

---

## Exemplos Práticos

### Exemplo 1: Consulta Simples

```javascript
const cnpjService = require('./modules/cnpj/cnpj.service');

async function exemplo1() {
  try {
    const dados = await cnpjService.consultarCNPJ('11222333000181');
    
    console.log('Razão Social:', dados.razaoSocial);
    console.log('CNAE Principal:', dados.cnaePrincipal);
    console.log('Endereço:', dados.endereco);
    console.log('Telefones:', dados.contatos.telefones);
    
  } catch (erro) {
    console.error('Erro:', erro.message);
  }
}
```

### Exemplo 2: Validação de Fornecedores em Lote

```javascript
async function validarFornecedores(listaFornecedores) {
  const resultados = [];
  
  for (const fornecedor of listaFornecedores) {
    try {
      const dados = await cnpjService.consultarCNPJ(fornecedor.cnpj);
      
      // Validações
      const validacoes = {
        cnpjValido: true,
        ativo: dados.situacaoCadastral === 'Ativa',
        simples: dados.simples.optante,
        telefoneRegistrado: dados.contatos.telefones.length > 0,
        emailRegistrado: !!dados.contatos.email
      };

      resultados.push({
        cnpj: fornecedor.cnpj,
        razaoSocial: dados.razaoSocial,
        validacoes,
        statusGeral: Object.values(validacoes).every(v => v) ? 'VÁLIDO' : 'ATENÇÃO'
      });

    } catch (erro) {
      resultados.push({
        cnpj: fornecedor.cnpj,
        erro: erro.message,
        statusGeral: 'ERRO'
      });
    }

    // Delay para respeitar rate limit
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return resultados;
}
```

### Exemplo 3: Integração com Express

```javascript
const express = require('express');
const app = express();
const cnpjRoutes = require('./modules/cnpj/cnpj.routes');
const errorHandler = require('./middleware/errorHandler');

app.use(express.json());

// Rotas
app.use('/api/cnpj', cnpjRoutes);

// Tratamento de erros
app.use(errorHandler);

// Iniciar servidor
app.listen(3000, () => {
  console.log('Servidor rodando em http://localhost:3000');
});
```

**Teste com cURL:**

```bash
# Consulta simples
curl -X POST http://localhost:3000/api/cnpj/consultar \
  -H "Content-Type: application/json" \
  -d '{"cnpj": "11.222.333/0001-81"}'

# Consultas múltiplas
curl -X POST http://localhost:3000/api/cnpj/consultar-multiplos \
  -H "Content-Type: application/json" \
  -d '{
    "cnpjs": [
      "11.222.333/0001-81",
      "12.345.678/0001-90"
    ]
  }'
```

---

## Comparativo de APIs

| Aspecto | OpenCNPJ | CNPJ.ws | CNPJá |
|---------|----------|---------|-------|
| **Custo** | Gratuito | Gratuito | Gratuito (público) + Pago |
| **Rate Limit** | 50 req/s por IP | 3 req/min por IP | 5 req/min (público) |
| **Autenticação** | Não requer | Não requer | Não requer (público) |
| **Tempo Resposta** | ~150ms MISS, ~40ms HIT | ~200ms | ~500ms |
| **Dados Principais** | ✅ Completo | ✅ Completo | ✅ Mais completo |
| **Pesquisa/Filtros** | ❌ Não | ❌ Não | ✅ Avançados |
| **Sócios** | ✅ Mascarado | ✅ Mascarado | ✅ Mais detalhes |
| **Inscrições Estaduais** | ✅ | ✅ | ✅ |
| **Simples Nacional** | ✅ | ✅ | ✅ |
| **PDF/Certificados** | ❌ | ❌ | ✅ (Comercial) |
| **Geocodificação** | ❌ | ❌ | ✅ (Comercial) |
| **Documentação** | Excelente | Excelente | Excelente |
| **SDK Oficial** | Não | Não | Sim (Node.js) |
| **Suporte** | Comunidade | Comunidade | Suporte pago |

### Recomendações de Uso

**Use OpenCNPJ quando:**
- Precisar de alta frequência de requisições (>50/s)
- Buscar simplicidade máxima
- Dados básicos são suficientes

**Use CNPJ.ws quando:**
- Taxa de consultas for moderada (≤3/min)
- Preferir trabalhar sem dependências externas
- Integração simples é prioritária

**Use CNPJá quando:**
- Precisar de filtros avançados e pesquisa
- Necessitar de dados em tempo real
- Validação de lotes for frequente
- Certificados em PDF forem necessários

---

## Considerações de Produção

### Logging Estruturado

**Arquivo: `src/config/logger.js`**

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;
```

### Monitoramento e Métricas

```javascript
class MetricasCNPJ {
  constructor() {
    this.requisicoes = 0;
    this.sucessos = 0;
    this.falhas = 0;
    this.tempoMedioMs = 0;
  }

  registrar(tempoMs, sucesso) {
    this.requisicoes++;
    if (sucesso) {
      this.sucessos++;
    } else {
      this.falhas++;
    }

    // Atualizar média móvel
    this.tempoMedioMs = 
      (this.tempoMedioMs * (this.requisicoes - 1) + tempoMs) / this.requisicoes;
  }

  obterRelatorio() {
    return {
      totalRequisicoes: this.requisicoes,
      sucessos: this.sucessos,
      falhas: this.falhas,
      taxaSucesso: `${((this.sucessos / this.requisicoes) * 100).toFixed(2)}%`,
      tempoMedioMs: this.tempoMedioMs.toFixed(0)
    };
  }
}
```

---

## Conclusão

Este guia fornece uma base sólida para implementar consultas de CNPJ em Node.js. Escolha a API que melhor se adequa às suas necessidades:

- **Simplicidade:** OpenCNPJ
- **Equilíbrio:** CNPJ.ws  
- **Recursos Completos:** CNPJá

Sempre respeite os limites de rate limit, implemente cache adequado e trate erros robustamente em produção.
