import json
import requests
import pandas as pd


def main():
    url = "http://localhost:8787/run-model"

    df = pd.DataFrame(
        {
            "effect": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            "se": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
            "n_obs": [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
        }
    )
    file_data = df.to_json(orient="records")

    parameters = json.dumps(
        {
            "modelType": "MAIVE",
            "includeStudyDummies": True,
            "standardErrorTreatment": "not_clustered",
            "computeAndersonRubin": False,
        }
    )

    response = requests.post(
        url=url,
        headers={"Content-Type": "application/json"},
        data=json.dumps({"file_data": file_data, "parameters": parameters}),
    )
    print(response.json())


if __name__ == "__main__":
    main()
