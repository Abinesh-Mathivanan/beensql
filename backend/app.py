# backend/app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
from upload_handler import handle_upload
from query_handler import handle_query

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

metadata_store = {} # Keep metadata store in app.py

@app.route('/api/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({'message': 'No file part'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'message': 'No selected file'}), 400

        if file:
            result = handle_upload(file, metadata_store) # Pass metadata_store
            return jsonify(result), 200
        else:
            return jsonify({'message': 'Upload failed'}), 400
    except Exception as e:
        print(f"Upload error: {e}")
        return jsonify({'message': 'File upload failed', 'error': str(e)}), 500

@app.route('/api/query', methods=['POST'])
def query_data():
    try:
        data = request.get_json()
        prompt = data.get('prompt')
        filename = data.get('filename')

        if not prompt or not filename:
            return jsonify({'message': 'Prompt and filename are required'}), 400

        if filename not in metadata_store:
            return jsonify({'message': 'Metadata not found for filename. Please upload file again.'}), 404

        metadata = metadata_store[filename] # Retrieve metadata from store
        result = handle_query(prompt, metadata)
        return jsonify(result), 200

    except Exception as e:
        print(f"Query error: {e}")
        return jsonify({'message': 'Error processing query', 'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)