from pathlib import Path
import importlib.util
import json


ROOT = Path(__file__).resolve().parents[1]
VERCEL_JSON = ROOT / "vercel.json"
API_DIR = ROOT / "api"
SEARCH_API = API_DIR / "search.py"
CHART_API = API_DIR / "chart.py"


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_vercel_config_exists_and_routes_api_requests():
    assert VERCEL_JSON.exists(), "vercel.json should exist for Vercel deployment"

    data = json.loads(VERCEL_JSON.read_text(encoding="utf-8"))
    assert data["version"] == 2
    rewrites = data.get("rewrites", [])
    assert {"source": "/api/search", "destination": "/api/search"} in rewrites
    assert {"source": "/api/chart", "destination": "/api/chart"} in rewrites


def test_vercel_python_functions_exist_for_search_and_chart():
    assert SEARCH_API.exists(), "api/search.py should exist for Vercel"
    assert CHART_API.exists(), "api/chart.py should exist for Vercel"

    search_module = load_module(SEARCH_API, "stock_vercel_search")
    chart_module = load_module(CHART_API, "stock_vercel_chart")

    assert callable(getattr(search_module, "app", None)), "api/search.py must expose a WSGI app"
    assert callable(getattr(chart_module, "app", None)), "api/chart.py must expose a WSGI app"
