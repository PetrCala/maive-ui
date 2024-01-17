import os

from flask import Flask

from app.routes import script_route

app = Flask(__name__)

# Register the routes
app.register_blueprint(script_route.bp)

if __name__ == "__main__":
    # Get environmental variables, or default if not set
    debug_mode = os.getenv("FLASK_ENV") == "development"
    host = os.getenv("FLASK_RUN_HOST", "0.0.0.0")
    port = int(os.getenv("FLASK_RUN_PORT", "8080"))
    app.run(debug=debug_mode, host="0.0.0.0", port=8080)
