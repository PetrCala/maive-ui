# Move to the routes folder later

from flask import render_template, redirect, url_for
from . import bp

@bp.route('/login')
def login():
    return render_template('login.html')

@bp.route('/register')
def register():
    return render_template('register.html')
