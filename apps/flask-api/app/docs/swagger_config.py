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
        "title": "Flask API",
        "description": "API documentation",
        "version": "1.0.0",
        "contact": {"email": "your-email@example.com"},
    },
    "host": "localhost:8080",
    "basePath": "/",
    "schemes": ["http"],
    "consumes": ["application/json"],
    "produces": ["application/json"],
}
