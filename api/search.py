import urllib.parse

from api.common import YAHOO, fetch_yahoo_json, get_first_param, json_response


def app(environ, start_response):
    q = get_first_param(environ, 'q', '')
    lang = get_first_param(environ, 'lang', 'ko')
    region = get_first_param(environ, 'region', 'KR')

    url = (
        f'{YAHOO}/v1/finance/search'
        f'?q={urllib.parse.quote(q)}'
        f'&quotesCount=8&newsCount=0'
        f'&lang={lang}&region={region}'
    )

    try:
        data = fetch_yahoo_json(url)
        return json_response(start_response, '200 OK', data)
    except Exception as exc:
        return json_response(start_response, '200 OK', {'quotes': [], 'error': str(exc)})
