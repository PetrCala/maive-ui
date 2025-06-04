import tomllib
from pathlib import Path

with open(Path(__file__).parent.parent.parent / "pyproject.toml", "rb") as f:
    project = tomllib.load(f)

swagger_config = {
    "headers": [],
    "specs": [
        {
            "endpoint": "apispec",
            "route": "/apispec.json",
            "rule_filter": lambda rule: True,
            "model_filter": lambda tag: True,
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/docs",
}


swagger_template = {
    "swagger": "2.0",
    "info": {
        "title": "Maive UI API",
        "description": "API documentation for Maive UI",
        "version": project["tool"]["poetry"]["version"],
        "contact": {"email": project["tool"]["poetry"]["authors"][0]},
    },
    "host": "localhost:8080",
    "basePath": "/",
    "schemes": ["http", "https"],
    "consumes": ["application/json"],
    "produces": ["application/json"],
}
