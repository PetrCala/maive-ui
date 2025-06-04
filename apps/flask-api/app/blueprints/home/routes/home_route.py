import os

from flask import Blueprint

from .. import bp


# Create a Blueprint
@bp.route("/")
def index():
    """
    Home page
    ---
    tags:
      - Home
    responses:
      200:
        description: Returns a welcome message
        schema:
          type: string
          example: "Flask server is running!"
    """
    r_api_url = os.getenv("R_API_URL")
    return f"Flask server is running!"
