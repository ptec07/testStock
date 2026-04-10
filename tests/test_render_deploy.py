from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[1]
RENDER_YAML = ROOT / "render.yaml"
REQUIREMENTS = ROOT / "requirements.txt"


def test_render_blueprint_exists_with_web_service_config():
    assert RENDER_YAML.exists(), "render.yaml should exist for Render deployment"

    data = yaml.safe_load(RENDER_YAML.read_text(encoding="utf-8"))

    assert isinstance(data, dict)
    services = data.get("services")
    assert isinstance(services, list) and services, "render.yaml must define at least one service"

    service = services[0]
    assert service["type"] == "web"
    assert service["env"] == "python"
    assert service["startCommand"] == "python3 server.py"
    assert service["rootDir"] == "."


def test_render_requirements_file_exists():
    assert REQUIREMENTS.exists(), "requirements.txt should exist for Render Python runtime"
