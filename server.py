#!/usr/bin/env python3
"""
StockCompare — 로컬 프록시 서버
Yahoo Finance API를 서버 사이드에서 호출해 CORS 문제를 우회합니다.
"""

import os
import json
import urllib.request
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler

YAHOO = 'https://query1.finance.yahoo.com'
HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/120.0.0.0 Safari/537.36'
    ),
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://finance.yahoo.com/',
    'Origin': 'https://finance.yahoo.com',
}


class Handler(SimpleHTTPRequestHandler):

    def do_GET(self):
        if self.path.startswith('/api/'):
            self._proxy()
        else:
            super().do_GET()

    def _proxy(self):
        qs     = self.path.split('?', 1)[1] if '?' in self.path else ''
        params = urllib.parse.parse_qs(qs)
        path   = self.path.split('?')[0]

        try:
            if path == '/api/search':
                q      = params.get('q', [''])[0]
                lang   = params.get('lang', ['ko'])[0]
                region = params.get('region', ['KR'])[0]
                url = (
                    f'{YAHOO}/v1/finance/search'
                    f'?q={urllib.parse.quote(q)}'
                    f'&quotesCount=8&newsCount=0'
                    f'&lang={lang}&region={region}'
                )

            elif path == '/api/chart':
                symbol  = params.get('symbol', [''])[0]
                period1 = params.get('period1', [''])[0]
                period2 = params.get('period2', [''])[0]
                url = (
                    f'{YAHOO}/v8/finance/chart/{urllib.parse.quote(symbol)}'
                    f'?period1={period1}&period2={period2}&interval=1d'
                )

            else:
                self._json_error(404, 'not found')
                return

            req  = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=12) as resp:
                data = resp.read()

            self.send_response(200)
            self._cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(data)

        except Exception as e:
            if path == '/api/search':
                body = json.dumps({'quotes': [], 'error': str(e)}).encode()
                self.send_response(200)
                self._cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(body)
                return
            self._json_error(500, str(e))

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')

    def _json_error(self, code, msg):
        body = json.dumps({'error': msg}).encode()
        self.send_response(code)
        self._cors()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        # 정적 파일 로그는 숨기고 API 요청만 출력
        if '/api/' in (args[0] if args else ''):
            print(f'[API] {args[0]}')


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    port   = int(os.environ.get('PORT', '8080'))
    server = HTTPServer(('0.0.0.0', port), Handler)
    print(f'✅ StockCompare 서버 시작: http://localhost:{port}')
    server.serve_forever()
