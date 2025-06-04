from flask import Blueprint, request, jsonify
from app.aws import S3Client

bp = Blueprint("upload", __name__)
s3_client = S3Client()


@bp.route("/", methods=["POST"])
def upload_file():
    """
    Upload a file to AWS S3
    ---
    tags:
      - upload
    parameters:
      - name: file
        in: formData
        type: file
        required: true
        description: The file to upload
      - name: folder
        in: formData
        type: string
        required: false
        description: Target folder in S3 bucket (defaults to 'uploads')
    responses:
      200:
        description: File uploaded successfully
        schema:
          type: object
          properties:
            success:
              type: boolean
            url:
              type: string
            key:
              type: string
      400:
        description: No file provided or invalid request
      500:
        description: Server error or AWS S3 error
    """
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"success": False, "error": "No file selected"}), 400

    folder = request.form.get("folder", "uploads")
    result = s3_client.upload_file(file, folder)

    if result["success"]:
        return jsonify(result), 200
    else:
        return jsonify(result), 500
