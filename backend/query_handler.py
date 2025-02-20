import google.generativeai as genai
import os
import re
import duckdb
import polars as pl
from groq import Groq
import logging
from dotenv import load_dotenv
import chardet  

load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def detect_encoding(file_path, n_bytes=10000):
    try:
        with open(file_path, "rb") as f:
            raw_data = f.read(n_bytes)
        detection = chardet.detect(raw_data)
        encoding = detection.get("encoding")
        if not encoding:
            encoding = "utf-8"
        return encoding
    except Exception as e:
        logging.error(f"Error detecting encoding: {e}")
        return "utf-8"

class ModelHandler:
    def __init__(self, provider, api_key=None):
        self.provider = provider
        self.model = self._configure_api(api_key)

    def _configure_api(self, api_key=None):
        api_key = os.environ.get(f'{self.provider.upper()}_API_KEY')
        if api_key is None:
            raise ValueError(f"API key for {self.provider} is missing. Please set {self.provider.upper()}_API_KEY as an environment variable.")
        if self.provider == 'gemini':
            genai.configure(api_key=api_key)
            return genai.GenerativeModel('gemini-2.0-flash')
        elif self.provider == 'groq':
            return Groq(api_key=api_key)
        else:
            raise ValueError(f"Invalid provider: {self.provider}")

    def generate_sql_query(self, user_query, column_names, previous_queries=None, previous_results=None, is_json=False):
        if self.provider == "gemini":
            prompt = self._construct_prompt(user_query, column_names, previous_queries, previous_results, is_json)
            response = self.model.generate_content(prompt)
            return response.text
        elif self.provider == "groq":
            prompt = self._construct_prompt(user_query, column_names, previous_queries, previous_results, is_json)
            response = self.model.chat.completions.create(
                model="llama3-70b-8192",
                messages=[{"role": "user", "content": prompt}]
            )
            return response.choices[0].message.content

    def _construct_prompt(self, user_query, column_names, previous_queries=None, previous_results=None, is_json=False):
        prompt = f"""
        You are a highly intelligent and robust AI assistant specializing in translating user's natural language queries into SQL for diverse databases.
        The user is querying a table named 'data' with the following columns and their types: {', '.join(column_names)}.

        **General Guidelines for Robust Query Generation:**

        1. Interpret user intent flexibly.
        2. Handle variations, abbreviations, and anomalies in data values.
        3. Prioritize semantic matching over exact string matching.
        4. Assume reasonable defaults if ambiguous.
        5. Focus on retrieving the data the user wants.
        6. Tolerate errors and produce a useful query.

        Given the user query: '{user_query}', generate a SQL query to retrieve the requested data from the table 'data'.
        """
        if is_json:
            prompt += """
            The data is in JSON format.
            Rules:
            1. Use the `->>` operator for JSON keys.
            2. Use nested `->>` for nested JSON.
            3. The column 'tables' contains JSON data.
            4. Use 'unnest' if 'tables' is an array of JSON.
            """
        else:
            prompt += """
            General SQL Rules:
            1. Select only the data asked for in the prompt.
            2. Use correct column names and data types.
            3. Follow standard SQL syntax for DuckDB.
            4. Return only the SQL query (no extra text).
            """
            if previous_queries:
                prompt += f"\nPrevious Queries:\n{previous_queries}"
            if previous_results:
                prompt += f"\nPrevious Results:\n{previous_results}"
            prompt += "\nOutput:\nSQL Query:"
        return prompt

class DatabaseHandler:
    def __init__(self, file_path, config=None):
        logging.info("DatabaseHandler __init__ started")
        self.file_path = file_path
        self.config = config or {}
        self.conn = self._create_connection()
        self.column_names = self._fetch_column_info()
        self.previous_queries = []
        self.previous_results = []
        self.is_json = os.path.splitext(self.file_path)[1].lower() == '.json'

    def _create_connection(self):
        try:
            conn = duckdb.connect(':memory:')
            file_extension = os.path.splitext(self.file_path)[1].lower()
            if file_extension == '.csv':
                conn.execute(f"CREATE TABLE data AS SELECT * FROM read_csv_auto('{self.file_path}', ignore_errors=true)")
            elif file_extension == '.json':
                conn.execute(f"CREATE TABLE data AS SELECT * FROM read_json_auto('{self.file_path}', ignore_errors=true)")
            else:
                raise ValueError(f"Unsupported file type: {file_extension}. Only CSV and JSON are supported.")
            return conn
        except Exception as e:
            logging.error(f"Error creating database connection: {e}")
            raise

    def _fetch_column_info(self):
        try:
            column_info = self.conn.execute("PRAGMA table_info('data')").fetchall()
            column_names = [f"{col[1]}::{col[2]}" for col in column_info]
            return column_names
        except Exception as e:
            logging.error(f"Error fetching column information: {e}")
            raise

    def execute_query(self, sql_query):
        try:
            encoding = detect_encoding(self.file_path)
            df = pl.read_csv(
                self.file_path,
                encoding=encoding,
                ignore_errors=True,
                null_values=["NA"],
                infer_schema_length=10000
            )
            con = duckdb.connect()
            con.register("data", df)
            result = con.execute(sql_query).fetchdf()
            polars_result = pl.from_pandas(result)
            self.previous_queries.append(sql_query)
            self.previous_results.append(str(polars_result))
            return polars_result
        except Exception as e:
            return f"Error executing query: {e}"

    def close(self):
        if self.conn:
            self.conn.close()

def clean_sql_query(sql_query):
    sql_query = re.sub(r'```sql', '', sql_query, flags=re.IGNORECASE)
    sql_query = re.sub(r'```', '', sql_query)
    sql_query = re.sub(r'\n', ' ', sql_query)
    return sql_query.strip()

def handle_query(user_prompt, metadata):
    db_handler = None
    try:
        model_provider = 'gemini'
        model_handler = ModelHandler(model_provider)
        db_handler = DatabaseHandler(file_path=metadata['file_path'])

        column_names = metadata['column_names']
        is_json_file = os.path.splitext(metadata['file_path'])[1].lower() == '.json'

        sql_query_raw = model_handler.generate_sql_query(
            user_prompt,
            column_names,
            db_handler.previous_queries,
            db_handler.previous_results,
            is_json=is_json_file
        )

        cleaned_sql_query = clean_sql_query(sql_query_raw)
        query_result = db_handler.execute_query(cleaned_sql_query)

        if isinstance(query_result, str):
            return {"query": cleaned_sql_query, "resultDescription": query_result, "result": None}

        if query_result.is_empty():
            return {"query": cleaned_sql_query, "resultDescription": "No data returned from this query.", "result": None}

        desired_columns = [col.split("::")[0] for col in metadata["column_names"]]
        if len(query_result.columns) == len(desired_columns):
            rename_map = dict(zip(query_result.columns, desired_columns))
            query_result = query_result.rename(rename_map)
        
        table = [query_result.columns] + query_result.to_numpy().tolist()

        col_widths = [max(len(str(item)) for item in col) for col in zip(*table)]
        table_str = "\n".join("  ".join(str(item).ljust(width) for item, width in zip(row, col_widths)) for row in table)

        return {
            "query": cleaned_sql_query,
            "resultDescription": "Query executed successfully.",
            "result": table_str
        }

    except Exception as e:
        error_message = f"Error processing query: {e}"
        logging.error(error_message)
        return {"query": None, "resultDescription": error_message, "result": None}
    finally:
        if db_handler:
            db_handler.close()
