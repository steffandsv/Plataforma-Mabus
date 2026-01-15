#!/usr/bin/env python3
"""
Descobrir se API tem endpoint para ITENS das licitações
"""
import requests
import json

print("🔍 INVESTIGAÇÃO: Endpoint de ITENS\n")

# Usar uma licitação do nosso JSON de sucesso
# numeroControlePNCP: "05995955000140-1-000001/2024"

base_api_consulta = "https://pncp.gov.br/api/consulta/v1"
base_api_pncp = "https://pncp.gov.br/api/pncp/v1"

# Tentar diferentes formas de acessar itens
test_cases = [
    {
        "name": "API Consulta - por numero controle",
        "url": f"{base_api_consulta}/contratacoes/05995955000140-1-000001/2024/itens"
    },
    {
        "name": "API Consulta - formato alternativo",
        "url": f"{base_api_consulta}/itens/05995955000140-1-000001/2024"
    },
    {
        "name": "API PNCP - por órgão/ano/sequencial",
        "url": f"{base_api_pncp}/orgaos/05995955000140/compras/2024/1/itens"
    },
    {
        "name": "API PNCP - formato alternativo",
        "url": f"{base_api_pncp}/orgaos/05995955000140/compras/2024/1"
    },
]

print("Testando diferentes endpoints para buscar itens:\n")

for test in test_cases:
    print(f"📋 {test['name']}")
    print(f"   URL: {test['url']}")
    
    try:
        response = requests.get(test['url'], timeout=10, headers={'Accept': 'application/json'})
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ SUCESSO!")
            print(f"   Tipo: {type(data)}")
            
            if isinstance(data, dict):
                print(f"   Chaves: {list(data.keys())[:10]}")
                
                # Procurar por itens
                if 'itens' in data:
                    print(f"   🎯 ENCONTRADO campo 'itens' com {len(data['itens'])} itens!")
                    if len(data['itens']) > 0:
                        print(f"   Exemplo de item: {list(data['itens'][0].keys())[:8]}")
                        
                        # Salvar
                        with open('pncp_item_example.json', 'w', encoding='utf-8') as f:
                            json.dump(data['itens'][0], f, indent=2, ensure_ascii=False)
                        print(f"   💾 Salvo exemplo em pncp_item_example.json")
                        
            elif isinstance(data, list):
                print(f"   Items no array: {len(data)}")
                if len(data) > 0:
                    print(f"   Exemplo: {list(data[0].keys())[:8]}")
                    
        elif response.status_code == 404:
            print(f"   ❌ Não encontrado")
        elif response.status_code == 401:
            print(f"   🔒 Requer autenticação")
        else:
            print(f"   ⚠️  Status {response.status_code}")
            
    except Exception as e:
        print(f"   💥 Erro: {str(e)[:60]}")
    
    print()

print("\n" + "="*70)
print("ANÁLISE: Estrutura completa de uma licitação")
print("="*70)

# Buscar detalhes completos de uma licitação
url = f"{base_api_pncp}/orgaos/05995955000140/compras/2024/1"
print(f"\nBuscando: {url}\n")

try:
    response = requests.get(url, timeout=10)
    if response.status_code == 200:
        data = response.json()
        
        print("✅ Dados obtidos com sucesso!")
        print(f"\nCampos disponíveis ({len(data)} campos):")
        
        for key, value in sorted(data.items()):
            tipo = type(value).__name__
            
            if isinstance(value, (str, int, float, bool)):
                valor_str = str(value)[:50]
                print(f"  • {key:35s} [{tipo:8s}] = {valor_str}")
            elif isinstance(value, list):
                print(f"  • {key:35s} [list] com {len(value)} itens")
            elif isinstance(value, dict):
                print(f"  • {key:35s} [dict] com {len(value)} campos")
            else:
                print(f"  • {key:35s} [{tipo}]")
        
        # Salvar completo
        with open('pncp_licitacao_completa.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"\n💾 Dados completos salvos em: pncp_licitacao_completa.json")
        
except Exception as e:
    print(f"❌ Erro: {e}")

print("\n✅ Investigação concluída!")
