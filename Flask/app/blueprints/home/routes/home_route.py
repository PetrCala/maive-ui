from flask import Blueprint
from .. import bp

# Create a Blueprint
@bp.route('/')
def index():
    return "Flask server is running!"
