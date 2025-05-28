import os

from flask import Flask

def create_app():
    app = Flask(__name__)

    def register_blueprints(app):
        from app.blueprints.auth import bp as auth_bp
        from app.blueprints.scripts import bp as scripts_bp
        from app.blueprints.home import bp as home_bp
        from app.blueprints.r_api import bp as r_api_bp
        app.register_blueprint(auth_bp, url_prefix="/auth")
        app.register_blueprint(scripts_bp, url_prefix="/scripts")
        app.register_blueprint(home_bp, url_prefix="/")
        app.register_blueprint(r_api_bp, url_prefix="/r_api")

    register_blueprints(app)
    return app

if __name__ == "__main__":
    # Get environmental variables, or default if not set
    debug_mode = os.getenv("FLASK_ENV") == "development"
    host = os.getenv("FLASK_RUN_HOST", "0.0.0.0")
    port = int(os.getenv("FLASK_RUN_PORT", "8080"))
    app = create_app()
    app.run(debug=debug_mode, host=host, port=port)
