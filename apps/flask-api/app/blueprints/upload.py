import pandas as pd
import tempfile
from pathlib import Path
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename

bp = Blueprint("upload", __name__)


@bp.route("", methods=["POST"])
def upload_excel():
    """
    Upload a csv file to the server
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
            filename:
              type: string
            filepath:
              type: string
            preview:
              type: array
              items:
                type: object
                properties:
                  [
                    {
                      "name": "string",
                      "value": "string",
                    }
                  ]
      400:
        description: No file provided or invalid request
      500:
        description: Server error or R plumber error
    """
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    f = request.files["file"]
    if f.filename == "":
        return jsonify({"error": "No file selected"}), 400

    filename = secure_filename(f.filename)
    tmp_path = Path(tempfile.gettempdir()) / filename
    f.save(tmp_path)

    df = pd.read_csv(tmp_path, nrows=20)
    preview = df.to_dict(orient="records")

    return {
        "filename": filename,
        "filepath": str(tmp_path),
        "preview": preview,
    }
