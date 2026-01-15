#!/usr/bin/env python3
"""
Script de teste para descobrir os endpoints corretos da API PNCP
"""
import requests
import json
from datetime import datetime

print("🔍 Testando API do PNCP - Portal Nacional de Contratações Públicas\n")

# Configurações de teste
DATA_INICIAL = "20240101"
DATA_FINAL = "20240105"

# Lista de URLs base para testar
BASE_URLS = [
    "https://pncp.gov.br/api/pncp/v1",
    "https://pncp.gov.br/pncp-api/v1",
    "https://pncp.gov.br/api/consulta/v1",
    "https://pncp.gov.br/api/v1",
]

# Lista de endpoints para testar
ENDPOINTS = [
    "/contratacoes",
    "/contratacoes/publicacao",
    "/orgaos",
    "/modalidades",
]

def test_endpoint(base_url, endpoint, params=None):
    """Testa um endpoint específico"""
    url = f"{base_url}{endpoint}"
    
    try:
        print(f"   Testando: {url}")
        response = requests.get(
            url,
            params=params,
            timeout=10,
            headers={
                'Accept': 'application/json',
                'User-Agent': 'Python-Test/1.0'
            }
        )
        
        print(f"   ✅ Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   📦 Tipo de resposta: {type(data)}")
            
            if isinstance(data, list):
                print(f"   📊 Quantidade de itens: {len(data)}")
                if len(data) > 0:
                    print(f"   🔑 Primeira chave do primeiro item: {list(data[0].keys())[:5]}")
            elif isinstance(data, dict):
                print(f"   🔑 Chaves principais: {list(data.keys())[:10]}")
                
            return True, response
        else:
            try:
                error_data = response.json()
                print(f"   ❌ Erro: {error_data}")
            except:
                print(f"   ❌ Erro: {response.text[:200]}")
            return False, response
            
    except requests.exceptions.Timeout:
        print(f"   ⏱️ Timeout")
        return False, None
    except requests.exceptions.ConnectionError:
        print(f"   🔌 Erro de conexão")
        return False, None
    except Exception as e:
        print(f"   💥 Erro: {str(e)[:100]}")
        return False, None

print("="*70)
print("TESTE 1: Descobrir URL base correta")
print("="*70)

working_base = None
working_endpoint = None

for base_url in BASE_URLS:
    print(f"\n🌐 Base URL: {base_url}")
    
    # Testar endpoint simples primeiro (sem parâmetros)
    for endpoint in ["/modalidades", "/orgaos"]:
        success, response = test_endpoint(base_url, endpoint)
        if success:
            working_base = base_url
            print(f"\n   🎉 FUNCIONOU! Base URL correta: {base_url}")
            break
    
    if working_base:
        break

if not working_base:
    print("\n❌ Nenhuma URL base funcionou. API pode estar offline ou mudou.")
    exit(1)

print("\n" + "="*70)
print("TESTE 2: Descobrir endpoint de contratações")
print("="*70)

print(f"\nUsando base: {working_base}")

# Testar endpoints de contratações COM parâmetros
contratacoes_endpoints = [
    "/contratacoes",
    "/contratacoes/publicacao",
    "/contratos",
    "/contratos/publicacao",
]

params_options = [
    {
        "dataInicial": DATA_INICIAL,
        "dataFinal": DATA_FINAL,
        "pagina": 1,
        "tamanhoPagina": 10
    },
    {
        "dataInicial": DATA_INICIAL,
        "dataFinal": DATA_FINAL,
        "page": 1,
        "size": 10
    },
    {
        "dataInicio": DATA_INICIAL,
        "dataFim": DATA_FINAL,
    }
]

for endpoint in contratacoes_endpoints:
    print(f"\n📋 Endpoint: {endpoint}")
    
    for i, params in enumerate(params_options, 1):
        print(f"\n   Tentativa {i} - Params: {params}")
        success, response = test_endpoint(working_base, endpoint, params)
        
        if success:
            working_endpoint = endpoint
            print(f"\n   🎉 FUNCIONOU!")
            print(f"   📝 URL completa: {working_base}{endpoint}")
            print(f"   📝 Parâmetros que funcionaram: {params}")
            
            # Salvar exemplo de resposta
            try:
                data = response.json()
                with open('pncp_response_example.json', 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                print(f"   💾 Exemplo de resposta salvo em: pncp_response_example.json")
            except:
                pass
            
            break
    
    if working_endpoint:
        break

print("\n" + "="*70)
print("RESULTADO FINAL")
print("="*70)

if working_base and working_endpoint:
    print(f"\n✅ URL Base: {working_base}")
    print(f"✅ Endpoint: {working_endpoint}")
    print(f"\n📝 Use no código Node.js:")
    print(f"   this.baseURL = '{working_base}';")
    print(f"   endpoint: '{working_endpoint}'")
else:
    print("\n❌ Não consegui encontrar um endpoint de contratações funcionando.")
    print("   Verificando se há documentação alternativa...")

print("\n✅ Script concluído!")
