import json
import urllib.parse
import urllib.request
from typing import Callable, Iterable

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


def fetch_yahoo_json(url: str, timeout: int = 12) -> bytes:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def json_response(start_response: Callable, status: str, body: dict | list | str | bytes) -> Iterable[bytes]:
    if isinstance(body, (dict, list)):
        payload = json.dumps(body).encode('utf-8')
    elif isinstance(body, str):
        payload = body.encode('utf-8')
    else:
        payload = body

    start_response(status, [
        ('Content-Type', 'application/json; charset=utf-8'),
        ('Access-Control-Allow-Origin', '*'),
        ('Cache-Control', 'no-store'),
    ])
    return [payload]


def get_first_param(environ: dict, key: str, default: str = '') -> str:
    query = urllib.parse.parse_qs(environ.get('QUERY_STRING', ''), keep_blank_values=True)
    return query.get(key, [default])[0]
