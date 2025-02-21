from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin
import os
import csv
from dotenv import load_dotenv
from upload_handler import handle_upload
from query_handler import handle_query

load_dotenv()

app = Flask(__name__)
CORS(app, supports_credentials=True, resources={r"/*": {"origins": "*"}})

metadata_store = {}  

@app.route('/api/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({'message': 'No file part'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'message': 'No selected file'}), 400

        if file:
            result = handle_upload(file, metadata_store)  # Make sure handle_upload saves metadata properly!
            return jsonify(result), 200
        else:
            return jsonify({'message': 'Upload failed'}), 400
    except Exception as e:
        print(f"Upload error: {e}")
        return jsonify({'message': 'File upload failed', 'error': str(e)}), 500

@app.route('/api/query', methods=['POST'])
@cross_origin()
def query_data():
    try:
        data = request.get_json()
        prompt = data.get('prompt')
        filename = data.get('filename')

        if not prompt or not filename:
            return jsonify({'message': 'Prompt and filename are required'}), 400

        if filename not in metadata_store:
            return jsonify({'message': 'Metadata not found for filename. Please upload file again.'}), 404

        metadata = metadata_store[filename]
        result = handle_query(prompt, metadata)
        return jsonify(result), 200

    except Exception as e:
        print(f"Query error: {e}")
        return jsonify({'message': 'Error processing query', 'error': str(e)}), 500

@app.route('/api/columns', methods=['GET'])
def get_columns():
    """
    Retrieve column names for the given file.
    Expects a query parameter 'filename'.
    """
    filename = request.args.get('filename')
    if not filename:
        return jsonify({'message': 'Filename is required'}), 400
    
    normalized_filename = filename.lower()

    if normalized_filename not in metadata_store:
        return jsonify({'message': 'Metadata not found for filename.'}), 404

    metadata = metadata_store[normalized_filename]
    columns = metadata.get("columns") or metadata.get("column_names")
    
    if not columns:
        file_path = metadata.get("file_path") or metadata.get("filepath")
        if not file_path or not os.path.exists(file_path):
            return jsonify({'message': 'File path not available in metadata.'}), 404
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                import csv
                reader = csv.reader(f)
                columns = next(reader)
            metadata["columns"] = columns
        except Exception as e:
            return jsonify({'message': 'Error parsing CSV header', 'error': str(e)}), 500

    return jsonify({"columns": columns}), 200


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))  # Render provides a PORT env variable
    app.run(host="0.0.0.0", port=port)
