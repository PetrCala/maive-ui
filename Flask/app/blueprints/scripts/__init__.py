from flask import Blueprint

bp = Blueprint('scripts', __name__)

from .routes import script_route, view, create, edit
