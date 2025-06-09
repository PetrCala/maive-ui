import os
from flask import Flask, Blueprint
from flasgger import Swagger
from app.docs.swagger_config import swagger_config, swagger_template


def create_app():
    app = Flask(__name__)

    def register_blueprints(app):
        from app.blueprints.scripts import bp as scripts_bp
        from app.blueprints.home import bp as home_bp
        from app.blueprints.r_api import bp as r_api_bp
        from app.blueprints.upload import bp as upload_bp

        api_bp = Blueprint("api", __name__, url_prefix="/api")

        api_bp.register_blueprint(scripts_bp, url_prefix="/scripts")
        api_bp.register_blueprint(home_bp, url_prefix="/")
        api_bp.register_blueprint(r_api_bp, url_prefix="/r_api")
        api_bp.register_blueprint(upload_bp, url_prefix="/upload")

        app.register_blueprint(api_bp, url_prefix="/api")

    register_blueprints(app)

    return app


if __name__ == "__main__":
    # Get environmental variables, or default if not set
    debug_mode = os.getenv("FLASK_ENV") == "development"
    host = os.getenv("FLASK_RUN_HOST", "0.0.0.0")
    port = int(os.getenv("FLASK_RUN_PORT", "8080"))
    app = create_app()
    swagger = Swagger(app, config=swagger_config, template=swagger_template)
    app.run(debug=debug_mode, host=host, port=port)
