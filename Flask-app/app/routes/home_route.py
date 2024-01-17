from flask import Blueprint

# Create a Blueprint
bp = Blueprint('home', __name__)

@bp.route('/')
def index():
    return "Flask server is running!"
