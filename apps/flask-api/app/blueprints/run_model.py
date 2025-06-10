import requests
import pandas as pd
from flask import Blueprint, request

bp = Blueprint("run_model", __name__)


@bp.route("", methods=["POST"])
def run_model():
    """
    Run the model on the given file
    ---
    tags:
      - run-model
    parameters:
      - name: filepath
        in: formData
        type: string
        required: true
        description: The path to the file to run the model on
    responses:
      200:
        description: Model run successfully
        schema:
          type: object
          properties:
            summary:
              type: string
            plots:
              type: array
              items:
                type: object
                properties:
                  name:
                    type: string
                  value:
                    type: string
    """
    data = request.get_json()
    filepath = data.get("filepath")

    if not filepath:
        return {"error": "Invalid filepath"}, 400

    # Read & transform file
    df = pd.read_csv(filepath)
    # cleaned_df = preprocess_for_model(df) # TODO
    cleaned_df = df

    # Forward to Plumber
    files = {"file": ("input.csv", cleaned_df.to_csv(index=False), "text/csv")}
    resp = requests.post("http://r-model/run", files=files)
    return resp.json()


# POST /api/run-model
# Body: { "filepath": "...", "cleaning": { ... } }
# ↳ { "summary": ..., "plots": [...] }
