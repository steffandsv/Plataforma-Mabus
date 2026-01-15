#!/usr/bin/env python3
"""
Investigação PROFUNDA: Como baixar os arquivos REAIS (PDF/ZIP) do PNCP
"""
import requests
import json
import os

print("🔬 INVESTIGAÇÃO PROFUNDA: Download de Arquivos PNCP\n")

# Dados de teste
cnpj = "05995955000140"
ano = 2024
seq = 1

# ============================================================================
# PARTE 1: Listar arquivos disponíveis
# ============================================================================
print("="*70)
print("PARTE 1: Listando arquivos disponíveis")
print("="*70)

url_list = f"https://pncp.gov.br/api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{seq}/arquivos"
print(f"\nURL: {url_list}\n")

try:
    r = requests.get(url_list, timeout=10)
    if r.status_code == 200:
        arquivos = r.json()
        print(f"✅ {len(arquivos)} arquivo(s) encontrado(s)\n")
        
        for i, arq in enumerate(arquivos[:3], 1):  # Mostrar apenas 3 primeiros
            print(f"Arquivo {i}:")
            print(f"  Título: {arq.get('titulo')}")
            print(f"  Tipo: {arq.get('tipoDocumentoNome')}")
            print(f"  URL: {arq.get('url')}")
            print(f"  Sequencial: {arq.get('sequencialDocumento')}")
            print()
        
        # Salvar para análise
        with open('arquivos_list.json', 'w', encoding='utf-8') as f:
            json.dump(arquivos, f, indent=2, ensure_ascii=False)
        print("💾 Lista completa salva em: arquivos_list.json\n")
        
        primeiro_arquivo = arquivos[0]
        seq_doc = primeiro_arquivo['sequencialDocumento']
        
    else:
        print(f"❌ Erro {r.status_code}")
        exit(1)
except Exception as e:
    print(f"💥 Erro: {e}")
    exit(1)

# ============================================================================
# PARTE 2: Tentar baixar arquivo individual
# ============================================================================
print("="*70)
print("PARTE 2: Tentando baixar arquivo individual")
print("="*70)

# Endpoint do arquivo específico
url_arquivo = f"https://pncp.gov.br/api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{seq}/arquivos/{seq_doc}"
print(f"\nURL do arquivo: {url_arquivo}\n")

try:
    r = requests.get(url_arquivo, timeout=10, allow_redirects=True)
    print(f"Status: {r.status_code}")
    print(f"Content-Type: {r.headers.get('Content-Type')}")
    print(f"Content-Length: {r.headers.get('Content-Length')} bytes")
    
    # Verificar se é JSON ou binário
    content_type = r.headers.get('Content-Type', '')
    
    if 'application/json' in content_type:
        print("\n📄 Resposta é JSON:")
        data = r.json()
        print(json.dumps(data, indent=2, ensure_ascii=False))
        
        # Ver se tem campo 'arquivo' ou 'download' ou similar
        print("\n🔍 Campos disponíveis:")
        for key in data.keys():
            print(f"  - {key}: {type(data[key]).__name__}")
            
    elif 'application/pdf' in content_type or 'application/zip' in content_type:
        print(f"\n✅ É um arquivo binário! ({content_type})")
        filename = f"arquivo_{seq_doc}.pdf" if 'pdf' in content_type else f"arquivo_{seq_doc}.zip"
        
        with open(filename, 'wb') as f:
            f.write(r.content)
        
        print(f"💾 Arquivo salvo: {filename}")
        print(f"   Tamanho: {len(r.content)} bytes")
    else:
        print(f"\n⚠️  Content-Type desconhecido: {content_type}")
        print(f"Primeiros 200 chars:\n{r.text[:200]}")
        
except Exception as e:
    print(f"💥 Erro: {e}")

# ============================================================================
# PARTE 3: Testar endpoints alternativos
# ============================================================================
print("\n" + "="*70)
print("PARTE 3: Testando endpoints alternativos")
print("="*70)

endpoints_testar = [
    f"https://pncp.gov.br/api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{seq}/arquivos/{seq_doc}/download",
    f"https://pncp.gov.br/api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{seq}/arquivos/{seq_doc}/conteudo",
    f"https://pncp.gov.br/api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{seq}/arquivos/{seq_doc}/arquivo",
    f"https://pncp.gov.br/pncp-api/v1/orgaos/{cnpj}/compras/{ano}/{seq}/arquivos/{seq_doc}",
    f"https://pncp.gov.br/api/consulta/v1/orgaos/{cnpj}/compras/{ano}/{seq}/arquivos/{seq_doc}",
]

for url_test in endpoints_testar:
    print(f"\n📍 Testando: {url_test}")
    try:
        r = requests.get(url_test, timeout=10, allow_redirects=True)
        print(f"   Status: {r.status_code}")
        
        if r.status_code == 200:
            content_type = r.headers.get('Content-Type', '')
            print(f"   Content-Type: {content_type}")
            
            if 'application/pdf' in content_type or 'application/octet-stream' in content_type:
                print(f"   ✅ BINÁRIO ENCONTRADO! Tamanho: {len(r.content)} bytes")
                
                filename = f"teste_endpoint_{seq_doc}.pdf"
                with open(filename, 'wb') as f:
                    f.write(r.content)
                print(f"   💾 Salvo: {filename}")
                break
            elif 'application/json' in content_type:
                data = r.json()
                print(f"   JSON com {len(data)} campos")
                if 'arquivo' in data or 'conteudo' in data or 'download' in data:
                    print(f"   🎯 Campo interessante encontrado!")
                    print(f"   Campos: {list(data.keys())}")
        elif r.status_code == 404:
            print(f"   ❌ Não encontrado")
        else:
            print(f"   ⚠️  Status {r.status_code}")
            
    except Exception as e:
        print(f"   💥 Erro: {str(e)[:60]}")

# ============================================================================
# PARTE 4: Verificar se há campo de hash/chave no JSON
# ============================================================================
print("\n" + "="*70)
print("PARTE 4: Analisando estrutura JSON do arquivo")
print("="*70)

url_json = f"https://pncp.gov.br/api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{seq}/arquivos/{seq_doc}"
try:
    r = requests.get(url_json, timeout=10)
    if r.status_code == 200 and 'application/json' in r.headers.get('Content-Type', ''):
        data = r.json()
        
        print("\n📋 Estrutura completa do arquivo:")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        
        # Salvar
        with open('arquivo_detalhes.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print("\n💾 Salvo em: arquivo_detalhes.json")
        
        # Procurar por campos que possam indicar download
        campos_interessantes = ['hash', 'chave', 'token', 'link', 'download', 'arquivo', 'conteudo', 'base64']
        print("\n🔍 Procurando campos de download:")
        for campo in campos_interessantes:
            if campo in str(data).lower():
                print(f"   ✓ Encontrado: '{campo}'")
        
except Exception as e:
    print(f"💥 Erro: {e}")

print("\n" + "="*70)
print("✅ Investigação concluída!")
print("="*70)
print("\nArquivos gerados:")
print("  - arquivos_list.json (lista de todos os arquivos)")
print("  - arquivo_detalhes.json (detalhes do primeiro arquivo)")
print("  - *.pdf ou *.zip (se conseguiu baixar)")
