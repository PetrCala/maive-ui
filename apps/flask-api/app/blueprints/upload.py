import os
from pathlib import Path
import tempfile
import uuid
import requests
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from app import config

bp = Blueprint("upload", __name__)


@bp.route("", methods=["POST"])
def upload_excel():
    """
    Upload a file to R plumber
    ---
    tags:
      - upload
    parameters:
      - name: file
        in: formData
        type: file
        required: true
        description: The file to upload
    responses:
      200:
        description: File uploaded successfully
        schema:
          type: object
          properties:
            plumber:
              type: object
      400:
        description: No file provided or invalid request
      500:
        description: Server error or R plumber error
    """
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    # persist ephemerally
    fn = f"{uuid.uuid4()}_{secure_filename(file.filename)}"
    tmp_path = Path(tempfile.gettempdir()) / fn
    file.save(tmp_path)  # writes to /tmp (instance storage)

    try:
        with open(tmp_path, "rb") as fp:
            r = requests.post(
                config.R_API_URL,
                timeout=30,
                files={
                    "file": (
                        fn,
                        fp,
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    )
                },
            )
        r.raise_for_status()
        plumber_resp = r.json()
        return {"plumber": plumber_resp}

    finally:
        # nuke the temp file regardless of outcome
        try:
            tmp_path.unlink()
        except FileNotFoundError:
            pass
