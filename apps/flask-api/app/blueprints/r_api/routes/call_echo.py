import os
import requests

from flask import Blueprint, jsonify

from .. import bp

@bp.route('/echo', methods=['GET'])
def call_echo():
    r_api_url = os.getenv("R_API_URL")

    # The URL of your Plumber endpoint
    url = f"{r_api_url}/echo"

    # Parameters to send (if any)
    params = {'msg': 'hello'}

    # Make the GET request
    response = requests.get(url, params=params)

    # Check if the request was successful
    if response.status_code == 200:
        # Process the response if necessary
        data = response.json()
        return jsonify(data)
    else:
        return jsonify({'error': 'Request failed'}), response.status_code
