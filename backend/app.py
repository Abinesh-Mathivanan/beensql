from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin
import os
import csv
from dotenv import load_dotenv
from upload_handler import handle_upload
from query_handler import handle_query

load_dotenv()

app = Flask(__name__)
# Globally enable CORS for all routes.
CORS(app, supports_credentials=True, resources={r"/*": {"origins": "*"}})

# After-request hook to ensure CORS headers are always added.
@app.after_request
def add_cors_headers(response):
    # If the request had an Origin header, echo it back. Otherwise, allow all.
    origin = request.headers.get('Origin') or '*'
    response.headers['Access-Control-Allow-Origin'] = origin
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
    return response

metadata_store = {}  

# Handle OPTIONS for preflight and POST for file upload.
@app.route('/api/upload', methods=['POST', 'OPTIONS'])
def upload_file():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        if 'file' not in request.files:
            return jsonify({'message': 'No file part'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'message': 'No selected file'}), 400

        if file:
            result = handle_upload(file, metadata_store)  # Ensure handle_upload saves metadata properly.
            return jsonify(result), 200
        else:
            return jsonify({'message': 'Upload failed'}), 400
    except Exception as e:
        print(f"Upload error: {e}")
        return jsonify({'message': 'File upload failed', 'error': str(e)}), 500

# Handle OPTIONS for preflight and POST for query.
@app.route('/api/query', methods=['POST', 'OPTIONS'])
@cross_origin()
def query_data():
    if request.method == 'OPTIONS':
        return '', 204
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

# Handle OPTIONS for preflight and GET for columns.
@app.route('/api/columns', methods=['GET', 'OPTIONS'])
def get_columns():
    if request.method == 'OPTIONS':
        return '', 204
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
                reader = csv.reader(f)
                columns = next(reader)
            metadata["columns"] = columns
        except Exception as e:
            return jsonify({'message': 'Error parsing CSV header', 'error': str(e)}), 500

    return jsonify({"columns": columns}), 200

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))  # Render provides a PORT env variable.
    app.run(host="0.0.0.0", port=port)
