# backend/upload_handler.py
import os
import duckdb
import logging
import json
import polars as pl # not directly used here but might be used in query handler

UPLOAD_FOLDER = 'public/uploads'
ALLOWED_EXTENSIONS = {'csv', 'json'} # Adjusted to match script's supported types

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_column_info_from_file(file_path):
    """Extracts column names and types from a CSV or JSON file using DuckDB."""
    try:
        conn = duckdb.connect(database=':memory:', read_only=False)
        file_extension = os.path.splitext(file_path)[1].lower()
        if file_extension == '.csv':
            conn.execute(f"CREATE TABLE data AS SELECT * FROM read_csv_auto('{file_path}', ignore_errors=true)")
        elif file_extension == '.json':
            conn.execute(f"CREATE TABLE data AS SELECT * FROM read_json_auto('{file_path}', ignore_errors=true)")
        else:
            raise ValueError(f"Unsupported file type: {file_extension}. Only CSV and JSON are supported.")

        column_info = conn.execute("PRAGMA table_info('data')").fetchall()
        column_names = [f"{col[1]}::{col[2]}" for col in column_info] # Format as name::type
        conn.close()
        return column_names
    except Exception as e:
        logging.error(f"Error fetching column information: {e}")
        return None


def handle_upload(file, metadata_store):
    if not allowed_file(file.filename):
        return {'message': 'Unsupported file type'}

    filename = file.filename
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    file.save(filepath)

    column_names = get_column_info_from_file(filepath)

    if column_names:
        metadata_store[filename] = {'column_names': column_names, 'file_path': filepath} # Store column names and filepath
        return {'message': 'File uploaded and processed successfully.', 'filename': filename, 'metadata': {'column_names': column_names}}
    else:
        return {'message': 'File processing failed to extract column information.'}