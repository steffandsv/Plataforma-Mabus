import requests
import json
import datetime

BASE_URL = "https://pncp.gov.br/api/consulta/v1"

def test_date_query(desc, d_inicial, d_final):
    url = f"{BASE_URL}/contratacoes/publicacao"
    # Modalidade 8 (Dispensa)
    params = {
        "dataInicial": d_inicial,
        "dataFinal": d_final,
        "codigoModalidadeContratacao": 8,
        "pagina": 1,
        "tamanhoPagina": 50
    }
    print(f"\n--- Testing: {desc} ---")
    print(f"Query: {d_inicial} to {d_final}")
    try:
        response = requests.get(url, params=params, timeout=30)
        if response.status_code == 200:
            data = response.json()
            total = data.get('totalRegistros', 0)
            print(f"Status: 200 OK | Total Records: {total}")
            items = data.get('data', [])
            if items:
                # Need to find the last page to see late items if default sort is ascending
                total_pages = data.get('totalPaginas', 0)
                print(f"Total Pages: {total_pages}")
                
                if total_pages > 1:
                     print(f"Fetching last page {total_pages}...")
                     params['pagina'] = total_pages
                     resp_last = requests.get(url, params=params, timeout=30)
                     if resp_last.status_code == 200:
                         data_last = resp_last.json()
                         items_last = data_last.get('data', [])
                         if items_last:
                             last_item = items_last[-1]
                             print(f"Very Last Item Pub Date: {last_item.get('dataPublicacaoPncp')}")
                             
                             items.extend(items_last) 

                late_items = [i for i in items if 'T' in i.get('dataPublicacaoPncp', '') and int(i.get('dataPublicacaoPncp').split('T')[1][:2]) >= 12]
                print(f"Items published after 12:00 (checked first/last page): {len(late_items)}")
                if late_items:
                    print(f"Sample Late Item: {late_items[0].get('dataPublicacaoPncp')}")

            return total
        else:
            print(f"Error: {response.status_code} - {response.text}")
            return -1
    except Exception as e:
        print(f"Exception: {e}")
        return -1

# Pick a date that likely has data (e.g. yesterday or few days ago, week day)
# Let's try 2025-01-08 (Wednesday) as mentioned by user
DATE_TARGET = "20250108"
NEXT_DAY = "20250109"

print("1. Testing Single Day Range (Same Start/End)")
count_same_day = test_date_query("Single Day", DATE_TARGET, DATE_TARGET)

print("\n2. Testing Two Day Range (Target + Next Day)")
count_two_day = test_date_query("Two Days", DATE_TARGET, NEXT_DAY)

if count_two_day > count_same_day:
    print(f"\n[INSIGHT] Two day range returned MORE items ({count_two_day}) than single day ({count_same_day}).")
    print("This suggests Single Day range might exclude items, OR it just adds the next day's items.")
else:
    print("\n[INSIGHT] Counts are similar or identical (considering pagination).")

