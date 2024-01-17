from flask import Blueprint, jsonify

from ..services import script_service
from .. import bp  # Import the blueprint from the parent module

@bp.route('/run_r_script', methods=['GET'])
def run_r_script():
    output = script_service.run_r_script()
    return jsonify({"output": output})
