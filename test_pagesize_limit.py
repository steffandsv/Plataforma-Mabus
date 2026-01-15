#!/usr/bin/env python3
"""
Investigação profunda: descobrir exatamente qual tamanhoPagina a API aceita
"""
import requests
import json

print("🔬 INVESTIGAÇÃO: Tamanho de Página Aceito pela API PNCP\n")

BASE_URL = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao"

# Parâmetros base (sabemos que funcionam)
base_params = {
    "dataInicial": "20240101",
    "dataFinal": "20240110",
    "codigoModalidadeContratacao": 6,  # Pregão Eletrônico (mesma do erro)
    "pagina": 1
}

# Testar diferentes tamanhos de página
tamanhos_para_testar = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 150, 200, 500]

print(f"Base URL: {BASE_URL}")
print(f"Modalidade: Pregão Eletrônico (6)")
print(f"Período: 2024-01-01 a 2024-01-10\n")
print("="*70)

resultados = {}

for tamanho in tamanhos_para_testar:
    params = base_params.copy()
    params["tamanhoPagina"] = tamanho
    
    try:
        response = requests.get(BASE_URL, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            total = data.get('totalRegistros', 0)
            itens = len(data.get('data', []))
            print(f"✅ tamanhoPagina={tamanho:3d} → Status 200 | Total: {total:4d} | Recebidos: {itens:3d}")
            resultados[tamanho] = 'OK'
        elif response.status_code == 204:
            print(f"ℹ️  tamanhoPagina={tamanho:3d} → Status 204 (sem conteúdo)")
            resultados[tamanho] = 'VAZIO'
        elif response.status_code == 400:
            try:
                erro = response.json()
                msg = erro.get('message', 'Erro desconhecido')
                print(f"❌ tamanhoPagina={tamanho:3d} → Status 400 | Erro: {msg}")
                resultados[tamanho] = f'ERRO: {msg}'
            except:
                print(f"❌ tamanhoPagina={tamanho:3d} → Status 400")
                resultados[tamanho] = 'ERRO 400'
        else:
            print(f"⚠️  tamanhoPagina={tamanho:3d} → Status {response.status_code}")
            resultados[tamanho] = f'Status {response.status_code}'
            
    except Exception as e:
        print(f"💥 tamanhoPagina={tamanho:3d} → Exceção: {str(e)[:50]}")
        resultados[tamanho] = f'Exception'

print("\n" + "="*70)
print("ANÁLISE DOS RESULTADOS")
print("="*70)

tamanhos_ok = [t for t, r in resultados.items() if r == 'OK']
tamanhos_erro = [t for t, r in resultados.items() if 'ERRO' in r or 'Exception' in r]

if tamanhos_ok:
    print(f"\n✅ Tamanhos que FUNCIONAM: {tamanhos_ok}")
    print(f"   Máximo aceito: {max(tamanhos_ok)}")
    print(f"   Mínimo aceito: {min(tamanhos_ok)}")
else:
    print("\n❌ Nenhum tamanho funcionou!")

if tamanhos_erro:
    print(f"\n❌ Tamanhos que FALHAM: {tamanhos_erro}")

# Teste adicional: verificar se o problema é específico da modalidade
print("\n" + "="*70)
print("TESTE BÔNUS: Outras modalidades com tamanhoPagina=50")
print("="*70)

modalidades_testar = [
    (8, "Dispensa"),
    (6, "Pregão Eletrônico"),
    (1, "Leilão Eletrônico")
]

for mod_id, mod_nome in modalidades_testar:
    params = {
        "dataInicial": "20240101",
        "dataFinal": "20240110",
        "codigoModalidadeContratacao": mod_id,
        "pagina": 1,
        "tamanhoPagina": 50
    }
    
    try:
        response = requests.get(BASE_URL, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            total = data.get('totalRegistros', 0)
            print(f"✅ {mod_nome:20s} (id={mod_id}) → OK, total={total}")
        elif response.status_code == 204:
            print(f"ℹ️  {mod_nome:20s} (id={mod_id}) → Sem resultados")
        elif response.status_code == 400:
            erro = response.json()
            msg = erro.get('message', '')
            print(f"❌ {mod_nome:20s} (id={mod_id}) → ERRO: {msg}")
        else:
            print(f"⚠️  {mod_nome:20s} (id={mod_id}) → Status {response.status_code}")
    except Exception as e:
        print(f"💥 {mod_nome:20s} (id={mod_id}) → {str(e)[:40]}")

print("\n✅ Investigação concluída!")
print("\nRecomendação: Use tamanhoPagina = {} (valor seguro)".format(max(tamanhos_ok) if tamanhos_ok else "???"))
