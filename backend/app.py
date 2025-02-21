from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import csv
from dotenv import load_dotenv
from upload_handler import handle_upload
from query_handler import handle_query

load_dotenv()

app = Flask(__name__)

# Define allowed origins - you should modify these based on your environments
ALLOWED_ORIGINS = [
    'http://localhost:3000',  # Local development
    'http://localhost:5000', 
    'https://beensql.vercel.app/' # Local Flask
]

# Configure CORS with specific origins and options
CORS(app, resources={
    r"/api/*": {
        "origins": ALLOWED_ORIGINS,
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True,
        "max_age": 3600  # Cache preflight requests for 1 hour
    }
})

metadata_store = {}

# Simplified CORS after-request handler
@app.after_request
def add_cors_headers(response):
    origin = request.headers.get('Origin')
    if origin in ALLOWED_ORIGINS:
        response.headers['Access-Control-Allow-Origin'] = origin
    return response

@app.route('/api/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({'error': {'message': 'No file part'}}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': {'message': 'No selected file'}}), 400

        if file:
            result = handle_upload(file, metadata_store)
            return jsonify(result), 200
        else:
            return jsonify({'error': {'message': 'Upload failed'}}), 400
    except Exception as e:
        print(f"Upload error: {e}")
        return jsonify({'error': {'message': str(e)}}), 500

@app.route('/api/query', methods=['POST'])
def query_data():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': {'message': 'No JSON data received'}}), 400

        prompt = data.get('prompt')
        filename = data.get('filename')

        if not prompt or not filename:
            return jsonify({'error': {'message': 'Prompt and filename are required'}}), 400

        if filename not in metadata_store:
            return jsonify({'error': {'message': 'Metadata not found for filename. Please upload file again.'}}), 404

        metadata = metadata_store[filename]
        result = handle_query(prompt, metadata)
        return jsonify(result), 200

    except Exception as e:
        print(f"Query error: {e}")
        return jsonify({'error': {'message': str(e)}}), 500

@app.route('/api/columns', methods=['GET'])
def get_columns():
    filename = request.args.get('filename')
    if not filename:
        return jsonify({'error': {'message': 'Filename is required'}}), 400
    
    normalized_filename = filename.lower()

    if normalized_filename not in metadata_store:
        return jsonify({'error': {'message': 'Metadata not found for filename.'}}), 404

    metadata = metadata_store[normalized_filename]
    columns = metadata.get("columns") or metadata.get("column_names")
    
    if not columns:
        file_path = metadata.get("file_path") or metadata.get("filepath")
        if not file_path or not os.path.exists(file_path):
            return jsonify({'error': {'message': 'File path not available in metadata.'}}), 404
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.reader(f)
                columns = next(reader)
            metadata["columns"] = columns
        except Exception as e:
            return jsonify({'error': {'message': f'Error parsing CSV header: {str(e)}'}}), 500

    return jsonify({"columns": columns}), 200

# Error handlers
@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': {'message': 'Resource not found'}}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': {'message': 'Internal server error'}}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)