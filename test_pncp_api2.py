#!/usr/bin/env python3
"""
Script de teste COMPLETO para API PNCP
Baseado na documentação real: a API requer CNPJ do órgão
"""
import requests
import json

print("🔍 Teste API PNCP - Descoberta de Estrutura Real\n")

BASE_URL = "https://pncp.gov.br/api/pncp/v1"

print("="*70)
print("TESTE 1: Listar modalidades (confirmação que API funciona)")
print("="*70)

response =requests.get(f"{BASE_URL}/modalidades", timeout=10)
print(f"Status: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    print(f"✅ {len(data)} modalidades encontradas")
    print(f"Exemplos: {[m['nome'] for m in data[:3]]}")

print("\n" + "="*70)
print("TESTE 2: Descobrir estrutura de busca por órgão + compras")
print("="*70)

# A API PNCP funciona assim: /orgaos/{cnpj}/compras/{ano}/{sequencial}
# Para buscar MÚLTIPLAS compras precisamos de outro endpoint

# Testar endpoint correto baseado na doc
test_cases = [
    {
        "name": "Busca por órgão específico",
        "url": f"{BASE_URL}/orgaos/00394460005887/compras/2024",
        "params": {}
    },
    {
        "name": "Consulta v1 contratacoes/publicacao", 
        "url": "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao",
        "params": {
            "dataInicial": "20240101",
            "dataFinal": "20240105",
            "pagina": 1,
            "tamanhoPagina": 10
        }
    },
    {
        "name": "Consulta v1 contratacoes apenas",
        "url": "https://pncp.gov.br/api/consulta/v1/contratacoes",
        "params": {
            "dataPublicacaoInicial": "20240101",
            "dataPublicacaoFinal": "20240105",
            "pagina": 1
        }
    },
]

for test in test_cases:
    print(f"\n📋 {test['name']}")
    print(f"   URL: {test['url']}")
    print(f"   Params: {test['params']}")
    
    try:
        r = requests.get(test['url'], params=test['params'], timeout=15)
        print(f"   Status: {r.status_code}")
        
        if r.status_code == 200:
            data = r.json()
            print(f"   ✅ SUCESSO!")
            print(f"   Tipo: {type(data)}")
            
            if isinstance(data, list):
                print(f"   Itens: {len(data)}")
                if len(data) > 0:
                    print(f"   Primeira chave: {list(data[0].keys())[:8]}")
                    
                    # Salvar resposta
                    with open('pncp_success.json', 'w') as f:
                        json.dump(data[:2], f, indent=2, ensure_ascii=False)
                    print(f"   💾 Salvo em: pncp_success.json")
                    
            elif isinstance(data, dict):
                print(f"   Chaves: {list(data.keys())}")
                if 'data' in data or 'items' in data:
                    items = data.get('data') or data.get('items')
                    if items:
                        print(f"   Items dentro: {len(items) if isinstance(items, list) else 'objeto'}")
                        
                        with open('pncp_success.json', 'w') as f:
                            json.dump(data, f, indent=2, ensure_ascii=False)
                        print(f"   💾 Salvo em: pncp_success.json")
            
        else:
            try:
                error = r.json()
                print(f"   ❌ Erro: {error.get('message', error)}")
            except:
                print(f"   ❌ Texto: {r.text[:150]}")
                
    except requests.exceptions.Timeout:
        print(f"   ⏱️ Timeout")
    except Exception as e:
        print(f"   💥 {str(e)[:100]}")

print("\n" + "="*70)
print("TESTE 3: Verificar documentação Swagger")
print("="*70)

swagger_urls = [
    "https://pncp.gov.br/api/pncp/v1/swagger-ui/index.html",
    "https://pncp.gov.br/api/consulta/v1/swagger-ui/index.html",
]

for url in swagger_urls:
    print(f"\n📚 {url}")
    try:
        r = requests.get(url, timeout=5)
        print(f"   Status: {r.status_code}")
        if r.status_code == 200:
            print(f"   ✅ Swagger disponível! Verifique manualmente: {url}")
    except:
        print(f"   ❌ Não disponível")

print("\n✅ Teste concluído!")
