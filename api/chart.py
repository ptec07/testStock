import urllib.parse

from api.common import YAHOO, fetch_yahoo_json, get_first_param, json_response


def app(environ, start_response):
    symbol = get_first_param(environ, 'symbol', '')
    period1 = get_first_param(environ, 'period1', '')
    period2 = get_first_param(environ, 'period2', '')

    if not symbol or not period1 or not period2:
        return json_response(start_response, '400 Bad Request', {
            'error': 'symbol, period1, period2 are required',
        })

    url = (
        f'{YAHOO}/v8/finance/chart/{urllib.parse.quote(symbol)}'
        f'?period1={period1}&period2={period2}&interval=1d'
    )

    try:
        data = fetch_yahoo_json(url)
        return json_response(start_response, '200 OK', data)
    except Exception as exc:
        return json_response(start_response, '500 Internal Server Error', {'error': str(exc)})
