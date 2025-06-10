# @app.post("/api/run-model")
# def run_model():
#     data = request.get_json()
#     file_id = data.get("file_id")

#     if not file_id or file_id not in FILE_STORE:
#         return {"error": "Invalid file_id"}, 400

#     file_path = FILE_STORE[file_id]

#     # Read & transform file
#     df = pd.read_excel(file_path)
#     cleaned_df = preprocess_for_model(df)

#     # Forward to Plumber
#     files = {"file": ("input.csv", cleaned_df.to_csv(index=False), "text/csv")}
#     resp = requests.post("http://r-model/run", files=files)
#     return resp.json()

# POST /api/run-model
# Body: { "file_id": "...", "cleaning": { ... } }
# ↳ { "summary": ..., "plots": [...] }
