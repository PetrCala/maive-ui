from flask import Blueprint

bp = Blueprint('home', __name__)

from .routes import home_route