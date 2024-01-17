from flask import render_template
from .. import bp  # Import the blueprint from the parent module

@bp.route('/scripts')
def list_scripts():
    return render_template('list_scripts.html')

@bp.route('/scripts/<int:id>')
def view_script(id):
    return render_template('view_script.html', id=id)
