import os

from flask import Blueprint

from .. import bp

# Create a Blueprint
@bp.route('/')
def index():
    r_api_url = os.getenv("R_API_URL")
    return f"Flask server is running!"