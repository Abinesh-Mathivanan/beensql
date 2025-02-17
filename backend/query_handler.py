# backend/query_handler.py
import google.generativeai as genai
import os
import re
import json
import duckdb
import polars as pl
from groq import Groq
import logging
from dotenv import load_dotenv

load_dotenv()  # Load environment variables for API keys

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class ModelHandler:
    def __init__(self, provider, api_key=None):
        self.provider = provider
        self.model = self._configure_api(api_key)

    def _configure_api(self, api_key=None):
        api_key = os.environ.get(f'{self.provider.upper()}_API_KEY') # get api key from env
        if api_key is None:
            raise ValueError(f"API key for {self.provider} is missing. Please set {self.provider.upper()}_API_KEY as an environment variable.")
        if self.provider == 'gemini':
            genai.configure(api_key=api_key)
            return genai.GenerativeModel('gemini-2.0-flash-exp') # using 'gemini-2.0-flash-exp' as in the script
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

        1. **Interpret User Intent Flexibly:** Understand the underlying intent of the user's query, even if the phrasing is not perfectly aligned with the database schema or data values.  Users may use synonyms, paraphrases, abbreviations, or different levels of detail.

        2. **Handle Variations in Data Values:** Be prepared for user queries to use slightly different terminology or phrasing compared to the exact values stored in the database.  For example:
        - User might say "high sales" when the database column is "sales_amount".
        - User might use a category name like "Electronics" when the database has "Electronic Products".
        - User might use abbreviations or common names instead of full names.

        3. **Prioritize Semantic Matching over Exact String Matching:**  When comparing user-provided values (e.g., in WHERE clauses), aim for semantic similarity rather than strict, case-sensitive string matching, where appropriate and if possible with SQL capabilities (e.g., using `LIKE`, case-insensitive functions, or fuzzy matching techniques if DuckDB offers them and if relevant to the query intent).

        4. **Assume Reasonable Defaults:** If the user's query is slightly ambiguous, make reasonable assumptions based on common sense and the context of the data to generate a useful query. If ambiguity is too high, generate the most likely query based on best interpretation.

        5. **Focus on Data Retrieval, Not Just Keyword Matching:** Generate SQL that actually retrieves the *data* the user is likely interested in, based on their intent, rather than just blindly translating keywords into SQL syntax.

        6. **Error Tolerance:** If a part of the user's query is unclear or potentially problematic, try to generate a query that still returns *some* relevant data, rather than failing completely.  If complete accuracy is impossible due to user input vagueness, prioritize returning *useful* data.

        Given the user query: '{user_query}', generate a SQL query to retrieve the requested data from the table 'data'.
        """
        if is_json:
            prompt += """
            The data inside the table is in JSON format.
            Rules:
            1. If querying a key inside the JSON object, use `->>` operator to specify the key.
            2. If the data has nested JSON objects, use nested `->>` operators to select the keys.
            3. The table column named `tables` contain data inside a json format.
            4. If the table column `tables` has an array of json, use `unnest` operator before accessing keys.
            """
        else:
            prompt +=  """
                General SQL Rules:
            """
            prompt += """
            1. Select only the data asked in the prompt. Do not return all columns unless explicitly requested.
            2. Ensure the query uses the correct column names and data types, casting as required.
            3. The query must follow standard SQL syntax rules for DuckDB.
            4. Return only the SQL query. Do not include any other text or explanation. Do not add markdown.
            """
            if previous_queries:
                prompt += f"\nPrevious Queries:\n{previous_queries}"

            if previous_results:
                prompt += f"\nPrevious Results:\n{previous_results}"

            prompt += """

            Output:
            SQL Query:
            """
            return prompt


class DatabaseHandler:
    def __init__(self, file_path, config=None):
        logging.info("DatabaseHandler __init__ started") # Log at start of __init__
        self.file_path = file_path
        self.config = config or {}
        logging.info("Calling _create_connection") # Log before _create_connection
        self.conn = self._create_connection()
        logging.info("Connection created successfully") # Log after _create_connection
        logging.info("Calling _fetch_column_info") # Log before _fetch_column_info
        self.column_names = self._fetch_column_info()
        logging.info("Column info fetched successfully") # Log after _fetch_column_info
        self.previous_queries = []
        self.previous_results = []
        self.is_json = os.path.splitext(self.file_path)[1].lower() == '.json'
        logging.info("DatabaseHandler __init__ completed") # Log at end of __init__

    def _create_connection(self):
        logging.info("_create_connection started") # Log at start of _create_connection
        try:
            conn = duckdb.connect(':memory:')
            file_extension = os.path.splitext(self.file_path)[1].lower()
            if file_extension == '.csv':
                conn.execute(f"CREATE TABLE data AS SELECT * FROM read_csv_auto('{self.file_path}', ignore_errors=true)")
            elif file_extension == '.json':
                conn.execute(f"CREATE TABLE data AS SELECT * FROM read_json_auto('{self.file_path}', ignore_errors=true)")
            else:
                raise ValueError(f"Unsupported file type: {file_extension}. Only CSV and JSON are supported.")
            logging.info("_create_connection completed successfully") # Log at end of _create_connection success
            return conn
        except Exception as e:
            logging.error(f"Error creating database connection in _create_connection: {e}") # Log error in _create_connection
            raise

    def _fetch_column_info(self):
        logging.info("_fetch_column_info started") # Log at start of _fetch_column_info
        try:
            column_info = self.conn.execute("PRAGMA table_info('data')").fetchall()
            column_names = [f"{col[1]}::{col[2]}" for col in column_info]
            logging.info(f"_fetch_column_info fetched column names: {column_names}") # Log fetched column names
            logging.info("_fetch_column_info completed successfully") # Log at end of _fetch_column_info success
            return column_names
        except Exception as e:
            logging.error(f"Error fetching column information in _fetch_column_info: {e}") # Log error in _fetch_column_info
            raise

    def execute_query(self, sql_query):
        try:
            logging.info(f"Executing SQL query: {sql_query}")
            result = self.conn.execute(sql_query).fetchall()
            if result:
                df = pl.DataFrame(result, strict=False)
                if df.shape[1] == 1 and self.is_json:
                    for col in df.columns:
                      if isinstance(df[col][0], str):
                         df = df.with_columns(pl.col(col).str.json_decode().alias(col))
                self.previous_queries.append(sql_query)
                self.previous_results.append(str(df))
                logging.debug(f"Query result:\n{df}")
                return df
            else:
                logging.info("No data returned")
                return pl.DataFrame()
        except duckdb.ParserException as e:
            logging.error(f"SQL syntax error: {e}")
            return f"Error: SQL Syntax error - Please check your query. Details: {e}"
        except duckdb.CatalogException as e:
            logging.error(f"Column name error: {e}")
            return f"Error: Column name error - Please check if the column names are correct. Details: {e}"
        except Exception as e:
            logging.error(f"An unexpected error occurred: {e}")
            return f"An unexpected error occurred: {e}. Please review the prompt or try again."

    def close(self):
        if self.conn:
            self.conn.close()
            logging.info("Database connection closed.")

def clean_sql_query(sql_query):
    sql_query = re.sub(r'```sql', '', sql_query, flags=re.IGNORECASE)
    sql_query = re.sub(r'```', '', sql_query)
    sql_query = re.sub(r'\n', ' ', sql_query)
    return sql_query.strip()


def handle_query(user_prompt, metadata):
    db_handler = None  # Initialize db_handler to None outside try block
    try:
        model_provider = 'gemini' # or choose_model() logic if you want to implement model choice in API
        model_handler = ModelHandler(model_provider) # Initialize ModelHandler
        db_handler = DatabaseHandler(file_path=metadata['file_path']) # Initialize DatabaseHandler

        column_names = metadata['column_names']
        is_json_file = os.path.splitext(metadata['file_path'])[1].lower() == '.json'

        sql_query_raw = model_handler.generate_sql_query(
            user_prompt,
            column_names,
            db_handler.previous_queries, # Pass previous queries
            db_handler.previous_results, # Pass previous results
            is_json=is_json_file
        )

        logging.info(f"Generated Raw SQL: {sql_query_raw}")
        cleaned_sql_query = clean_sql_query(sql_query_raw)
        logging.info(f"Cleaned SQL Query: {cleaned_sql_query}")

        query_result = db_handler.execute_query(cleaned_sql_query)

        if isinstance(query_result, str): # Error string from execute_query
            return {"query": cleaned_sql_query, "resultDescription": query_result, "result": None}
        elif query_result.is_empty():
            return {"query": cleaned_sql_query, "resultDescription": "No data returned from this query.", "result": None}
        else:
            result_dict = query_result.to_dicts() # Corrected to_dicts() here as well
            return {"query": cleaned_sql_query, "resultDescription": "Query executed successfully.", "result": result_dict}

    except Exception as e:
        error_message = f"Error processing query: {e}"
        logging.error(error_message)
        return {"query": None, "resultDescription": error_message, "result": None}
    finally:
        if db_handler: # Check if db_handler is not None before calling close
            db_handler.close()