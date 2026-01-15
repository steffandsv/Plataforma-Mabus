#!/usr/bin/env python3
"""
Teste FINAL - endpoint correto descoberto!
"""
import requests
import json

BASE_URL = "https://pncp.gov.br/api/consulta/v1"

print("🎯 TESTE FINAL - Endpoint Correto\n")

# O endpoint requer codigoModalidadeContratacao!
# Vamos testar com as modalidades disponíveis

# Primeiro buscar os códigos de modalidade
print("1️⃣ Buscando códigos de modalidade...")
mod_response = requests.get("https://pncp.gov.br/api/pncp/v1/modalidades")
modalidades = mod_response.json()

print(f"Modalidades disponíveis:")
for m in modalidades[:5]:
    print(f"   - {m['id']}: {m['nome']}")

# Testar com primeira modalidade
codigo_modalidade = modalidades[0]['id']

print(f"\n2️⃣ Testando com modalidade: {modalidades[0]['nome']} (código: {codigo_modalidade})")

url = f"{BASE_URL}/contratacoes/publicacao"
params = {
    "dataInicial": "20240101",
    "dataFinal": "20240105",
    "codigoModalidadeContratacao": codigo_modalidade,
    "pagina": 1,
    "tamanhoPagina": 5
}

print(f"\nURL: {url}")
print(f"Params: {params}\n")

response = requests.get(url, params=params, timeout=30)

print(f"Status: {response.status_code}")

if response.status_code == 200:
    data = response.json()
    print(f"✅✅✅ SUCESSO! ✅✅✅\n")
    print(f"Tipo: {type(data)}")
    
    if isinstance(data, list):
        print(f"Total recebido: {len(data)}")
        if len(data) > 0:
            print(f"\nPrimeiro item:")
            print(json.dumps(data[0], indent=2, ensure_ascii=False)[:1000])
            
            print(f"\nChaves disponíveis:")
            print(list(data[0].keys()))
            
            # Salvar
            with open('pncp_SUCESSO.json', 'w', encoding='utf-8') as f:
                json.dump(data[:2], f, indent=2, ensure_ascii=False)
            print(f"\n💾 Salvo em: pncp_SUCESSO.json")
    
    elif isinstance(data, dict):
        print(f"Chaves: {list(data.keys())}")
        print(json.dumps(data, indent=2, ensure_ascii=False)[:1500])
        
        with open('pncp_SUCESSO.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"\n💾 Salvo em: pncp_SUCESSO.json")
else:
    try:
        error = response.json()
        print(f"❌ Erro: {error}")
    except:
        print(f"❌ Texto: {response.text}")

print("\n" + "="*70)
print("CONCLUSÃO")
print("="*70)
print(f"\n✅ Base URL: {BASE_URL}")
print(f"✅ Endpoint: /contratacoes/publicacao")
print(f"✅ Parâmetros OBRIGATÓRIOS:")
print(f"   - dataInicial (YYYYMMDD)")
print(f"   - dataFinal (YYYYMMDD)")
print(f"   - codigoModalidadeContratacao (int)")
print(f"✅ Opcionais: pagina, tamanhoPagina")
