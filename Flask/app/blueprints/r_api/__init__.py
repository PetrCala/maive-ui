from flask import Blueprint

bp = Blueprint('r_api', __name__)

from .routes import call_echo