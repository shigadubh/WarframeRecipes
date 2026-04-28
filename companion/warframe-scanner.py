#!/usr/bin/env python3
"""
Warframe Inventory Scanner
Lê os arquivos locais do Warframe e extrai dados do inventário.
Gera um JSON que pode ser importado no Craft Tracker.

Uso:
  python warframe-scanner.py
  python warframe-scanner.py --watch   (monitora mudanças em tempo real)
  python warframe-scanner.py --server  (inicia servidor local para o site)
"""

import os
import re
import json
import sys
import time
import http.server
import threading
import webbrowser
from pathlib import Path
from datetime import datetime

# ============================================
# CONFIGURAÇÃO
# ============================================
WARFRAME_APPDATA = os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Warframe')
EE_LOG_PATH = os.path.join(WARFRAME_APPDATA, 'EE.log')

# Caminhos alternativos (Steam, Epic, standalone)
POSSIBLE_LOG_PATHS = [
    os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Warframe', 'EE.log'),
    os.path.join(os.environ.get('APPDATA', ''), 'Warframe', 'EE.log'),
]

# Pasta onde o Warframe salva dados de inventário em cache
WARFRAME_CACHE_DIR = os.path.join(WARFRAME_APPDATA, 'Cache.Windows')

OUTPUT_FILE = 'warframe_inventory.json'
SERVER_PORT = 8765


class WarframeInventoryScanner:
    """Escaneia arquivos locais do Warframe para extrair inventário."""

    def __init__(self):
        self.log_path = self._find_log()
        self.inventory = {}
        self.username = None
        self.last_scan = None

    def _find_log(self):
        """Encontra o arquivo EE.log do Warframe."""
        for path in POSSIBLE_LOG_PATHS:
            if os.path.exists(path):
                print(f"[✓] Log encontrado: {path}")
                return path

        # Busca manual
        print("[!] Log não encontrado nos caminhos padrão.")
        print("[?] Localizações tentadas:")
        for p in POSSIBLE_LOG_PATHS:
            print(f"    - {p}")

        custom = input("\n[?] Digite o caminho completo do EE.log (ou Enter para pular): ").strip()
        if custom and os.path.exists(custom):
            return custom

        return None

    def scan_ee_log(self):
        """
        Lê o EE.log e extrai informações relevantes.
        O log contém dados sobre itens carregados, blueprints, etc.
        """
        if not self.log_path or not os.path.exists(self.log_path):
            print("[✗] Arquivo EE.log não encontrado!")
            return False

        print(f"[...] Escaneando {self.log_path}...")
        file_size = os.path.getsize(self.log_path)
        print(f"[i] Tamanho do log: {file_size / 1024 / 1024:.1f} MB")

        found_items = {}
        username = None

        try:
            with open(self.log_path, 'r', encoding='utf-8', errors='ignore') as f:
                for line in f:
                    # Detectar nome do jogador
                    if 'Login:' in line or 'logged in' in line.lower():
                        match = re.search(r'Login:\s*(\S+)', line)
                        if match:
                            username = match.group(1)

                    # Detectar itens do inventário
                    # O log registra carregamento de itens
                    # Padrões comuns no EE.log:
                    self._parse_inventory_line(line, found_items)

        except Exception as e:
            print(f"[✗] Erro ao ler log: {e}")
            return False

        if username:
            self.username = username
            print(f"[✓] Jogador: {username}")

        self.inventory = found_items
        self.last_scan = datetime.now().isoformat()

        print(f"[✓] {len(found_items)} itens encontrados no log")
        return True

    def _parse_inventory_line(self, line, items):
        """
        Analisa uma linha do log buscando referências a itens do inventário.
        O EE.log registra várias operações com itens.
        """

        # Padrão: carregamento de scripts/objetos de itens
        # Exemplo: "Script [Info]: InventoryChange: /Lotus/Types/..."
        inventory_patterns = [
            # Blueprints
            (r'/Lotus/Types/Recipes/(\w+)/(\w+Blueprint)', 'Blueprint'),
            # Warframe parts
            (r'/Lotus/Types/Recipes/(\w+)/(\w+(?:Chassis|Neuroptics|Systems|Helmet))', 'Part'),
            # Weapon parts
            (r'/Lotus/Types/Recipes/(\w+)/(\w+(?:Barrel|Stock|Receiver|Blade|Handle|Guard|Grip|Link|String|Disc|Pouch|Stars))', 'WeaponPart'),
            # Prime parts
            (r'/Lotus/Types/Recipes/(\w+)/(\w+Prime\w*)', 'Prime'),
            # Generic item paths
            (r'/Lotus/Types/Items/MiscItems/(\w+)', 'Resource'),
            # Foundry operations
            (r'FoundryController.*?/Lotus/Types/Recipes/(\w+)/(\w+)', 'Foundry'),
        ]

        for pattern, item_type in inventory_patterns:
            matches = re.findall(pattern, line)
            for match in matches:
                if isinstance(match, tuple):
                    item_name = match[-1]  # Pega o último grupo
                    parent = match[0] if len(match) > 1 else ''
                else:
                    item_name = match
                    parent = ''

                # Converte CamelCase para nome legível
                readable = self._camel_to_readable(item_name)

                if parent:
                    parent_readable = self._camel_to_readable(parent)
                    full_name = f"{parent_readable} {readable}"
                else:
                    full_name = readable

                # Ignora itens muito genéricos
                if len(full_name) < 3:
                    continue

                items[full_name] = items.get(full_name, 0) + 1

    def _camel_to_readable(self, name):
        """Converte CamelCase para nome legível."""
        # AshPrimeChassis -> Ash Prime Chassis
        result = re.sub(r'([A-Z])', r' \1', name).strip()
        # Limpa duplicatas de espaço
        result = re.sub(r'\s+', ' ', result)
        return result

    def scan_cache_files(self):
        """
        Tenta ler arquivos de cache do Warframe para dados adicionais.
        O cache pode conter dados de inventário serializados.
        """
        if not os.path.exists(WARFRAME_CACHE_DIR):
            print(f"[!] Cache não encontrado: {WARFRAME_CACHE_DIR}")
            return

        print(f"[...] Escaneando cache em {WARFRAME_CACHE_DIR}...")
        cache_items = 0

        try:
            for file in os.listdir(WARFRAME_CACHE_DIR):
                filepath = os.path.join(WARFRAME_CACHE_DIR, file)
                if os.path.isfile(filepath):
                    try:
                        with open(filepath, 'rb') as f:
                            content = f.read()
                            # Busca por padrões JSON no cache
                            text = content.decode('utf-8', errors='ignore')
                            if 'Blueprint' in text or 'Chassis' in text:
                                cache_items += 1
                    except:
                        continue

            print(f"[i] {cache_items} arquivos de cache com possíveis dados de inventário")
        except Exception as e:
            print(f"[!] Erro no cache: {e}")

    def generate_import_json(self):
        """Gera JSON compatível com o Craft Tracker."""
        # Formata no padrão esperado pelo site
        # O site usa IDs no formato "ParentName::ComponentName"
        formatted_inventory = {}

        for item_name, count in self.inventory.items():
            # Tenta mapear para o formato do site
            # O scanner encontra nomes como "Ash Prime Chassis"
            # O site espera "Ash Prime::Chassis"
            parts = item_name.rsplit(' ', 1)
            if len(parts) == 2:
                parent, component = parts
                comp_id = f"{parent}::{component}"
                formatted_inventory[comp_id] = count
            else:
                formatted_inventory[item_name] = count

        output = {
            "user": self.username or "scanned_user",
            "inventory": formatted_inventory,
            "count": len(formatted_inventory),
            "date": self.last_scan or datetime.now().isoformat(),
            "version": 3,
            "source": "warframe-scanner"
        }

        return output

    def save_json(self, filepath=None):
        """Salva o inventário como JSON."""
        filepath = filepath or OUTPUT_FILE
        data = self.generate_import_json()

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"\n[✓] Inventário salvo em: {os.path.abspath(filepath)}")
        print(f"[i] {len(data['inventory'])} itens exportados")
        print(f"\n[!] Abra o Craft Tracker > Backup > Importar")
        print(f"[!] Cole o conteúdo do arquivo {filepath}")

        return data


class CompanionServer(http.server.BaseHTTPRequestHandler):
    """Servidor HTTP local que permite ao site acessar dados do scanner."""

    scanner = None

    def do_GET(self):
        # CORS headers
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

        if self.path == '/inventory':
            if self.scanner:
                self.scanner.scan_ee_log()
                data = self.scanner.generate_import_json()
                self.wfile.write(json.dumps(data).encode())
            else:
                self.wfile.write(json.dumps({"error": "Scanner not initialized"}).encode())

        elif self.path == '/status':
            self.wfile.write(json.dumps({
                "status": "online",
                "scanner": self.scanner is not None,
                "log_found": self.scanner.log_path is not None if self.scanner else False,
                "last_scan": self.scanner.last_scan if self.scanner else None
            }).encode())

        elif self.path == '/scan':
            if self.scanner:
                self.scanner.scan_ee_log()
                data = self.scanner.generate_import_json()
                self.wfile.write(json.dumps({
                    "success": True,
                    "items_found": len(data['inventory']),
                    "data": data
                }).encode())
            else:
                self.wfile.write(json.dumps({"success": False}).encode())

        else:
            self.wfile.write(json.dumps({"endpoints": ["/inventory", "/status", "/scan"]}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def log_message(self, format, *args):
        """Silencia logs do servidor."""
        pass


def run_server(scanner, port=SERVER_PORT):
    """Inicia o servidor companion local."""
    CompanionServer.scanner = scanner
    server = http.server.HTTPServer(('127.0.0.1', port), CompanionServer)
    print(f"\n[✓] Servidor companion rodando em http://127.0.0.1:{port}")
    print(f"[i] Endpoints:")
    print(f"    GET /status    - Status do scanner")
    print(f"    GET /inventory - Retorna inventário")
    print(f"    GET /scan      - Força novo scan + retorna dados")
    print(f"\n[!] Mantenha este terminal aberto enquanto usa o site!")
    print(f"[!] Pressione Ctrl+C para parar\n")
    server.serve_forever()


def watch_mode(scanner, interval=30):
    """Monitora o log por mudanças."""
    print(f"\n[👁] Modo monitor ativo (intervalo: {interval}s)")
    print("[!] Pressione Ctrl+C para parar\n")

    last_size = 0
    while True:
        try:
            if scanner.log_path and os.path.exists(scanner.log_path):
                current_size = os.path.getsize(scanner.log_path)
                if current_size != last_size:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] Log alterado, re-escaneando...")
                    scanner.scan_ee_log()
                    scanner.save_json()
                    last_size = current_size
                    print(f"[✓] Atualizado: {len(scanner.inventory)} itens")
            time.sleep(interval)
        except KeyboardInterrupt:
            print("\n[!] Monitor parado.")
            break


def main():
    print("=" * 50)
    print("  WARFRAME INVENTORY SCANNER")
    print("  Companion para o Craft Tracker")
    print("=" * 50)
    print()

    scanner = WarframeInventoryScanner()

    if '--server' in sys.argv:
        # Modo servidor: o site se conecta localmente
        scanner.scan_ee_log()
        run_server(scanner)

    elif '--watch' in sys.argv:
        # Modo monitor: atualiza automaticamente
        scanner.scan_ee_log()
        scanner.save_json()
        watch_mode(scanner)

    else:
        # Modo único: escaneia e exporta
        if scanner.scan_ee_log():
            scanner.scan_cache_files()
            data = scanner.save_json()

            print(f"\n{'=' * 50}")
            print(f"  RESULTADO DO SCAN")
            print(f"{'=' * 50}")
            print(f"  Jogador: {scanner.username or 'Não identificado'}")
            print(f"  Itens:   {len(data['inventory'])}")
            print(f"  Arquivo: {os.path.abspath(OUTPUT_FILE)}")
            print(f"{'=' * 50}")
            print()

            # Pergunta se quer abrir o servidor
            resp = input("[?] Deseja iniciar o servidor companion? (s/n): ").strip().lower()
            if resp in ('s', 'sim', 'y', 'yes'):
                run_server(scanner)
        else:
            print("\n[✗] Não foi possível escanear o inventário.")
            print("[!] Certifique-se de que o Warframe está instalado e já foi executado pelo menos uma vez.")


if __name__ == '__main__':
    main()
