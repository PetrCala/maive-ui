from flask import Blueprint, jsonify
from app.services import script_service

bp = Blueprint('script_route', __name__, url_prefix='/api')

@bp.route('/run_r_script', methods=['GET'])
def run_r_script():
    output = script_service.run_r_script()
    return jsonify({"output": output})
