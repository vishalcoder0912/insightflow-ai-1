"""SQL Executor — Load DataFrames into SQLite and run SQL queries."""

from __future__ import annotations

import sqlite3
import threading
from typing import Any

import pandas as pd


class SQLExecutor:
    """
    Manages an in-memory SQLite database backed by a Pandas DataFrame.
    
    Uploads the dataset once, then executes generated SQL queries against it.
    """

    def __init__(self):
        self._conn: sqlite3.Connection | None = None
        self._table_name: str = "dataset"
        self._columns: list[str] = []
        self._lock = threading.RLock()

    def load_dataframe(self, df: pd.DataFrame, table_name: str = "dataset") -> None:
        """Load a DataFrame into the in-memory SQLite database."""
        with self._lock:
            if self._conn:
                self._conn.close()

            self._conn = sqlite3.connect(":memory:", check_same_thread=False)
            self._table_name = table_name
            self._columns = list(df.columns)

            # Clean column names for SQL compatibility
            clean_df = df.copy()
            clean_df.columns = [
                col.strip().replace(" ", "_").replace("-", "_")
                for col in clean_df.columns
            ]
            self._columns = list(clean_df.columns)

            # Convert numeric columns
            for col in clean_df.columns:
                try:
                    clean_df[col] = pd.to_numeric(clean_df[col])
                except (ValueError, TypeError):
                    pass

            clean_df.to_sql(table_name, self._conn, if_exists="replace", index=False)

    def execute_query(self, sql: str) -> dict[str, Any]:
        """
        Execute a SQL query and return results.
        
        Returns dict with 'columns', 'rows', 'row_count', and 'error'.
        """
        with self._lock:
            if not self._conn:
                return {
                    "columns": [],
                    "rows": [],
                    "row_count": 0,
                    "error": "No dataset loaded. Upload a CSV first.",
                }

            try:
                # Safety: only allow SELECT queries
                clean_sql = sql.strip().upper()
                if not clean_sql.startswith("SELECT"):
                    return {
                        "columns": [],
                        "rows": [],
                        "row_count": 0,
                        "error": "Only SELECT queries are allowed.",
                    }

                cursor = self._conn.execute(sql)
                columns = [desc[0] for desc in cursor.description] if cursor.description else []
                rows = cursor.fetchall()

                return {
                    "columns": columns,
                    "rows": [list(row) for row in rows],
                    "row_count": len(rows),
                    "error": None,
                }

            except sqlite3.Error as e:
                return {
                    "columns": [],
                    "rows": [],
                    "row_count": 0,
                    "error": f"SQL execution error: {str(e)}",
                }

    def get_schema(self) -> str:
        """
        Get the table schema as a string for the Text-to-SQL prompt.
        
        Returns something like: dataset(id, name, age, salary)
        """
        if not self._columns:
            return ""
        return f"{self._table_name}({', '.join(self._columns)})"

    def get_column_info(self) -> list[dict[str, str]]:
        """Get column names and sample values for schema linking."""
        with self._lock:
            if not self._conn:
                return []

            info = []
            for col in self._columns:
                try:
                    cursor = self._conn.execute(
                        f"SELECT DISTINCT \"{col}\" FROM {self._table_name} LIMIT 5"
                    )
                    samples = [str(row[0]) for row in cursor.fetchall() if row[0] is not None]
                    info.append({"name": col, "samples": samples})
                except sqlite3.Error:
                    info.append({"name": col, "samples": []})

            return info

    def close(self) -> None:
        """Close the database connection."""
        with self._lock:
            if self._conn:
                self._conn.close()
                self._conn = None
            self._columns = []

    def health(self) -> dict[str, Any]:
        """Return quick database health information for diagnostics."""
        with self._lock:
            return {
                "connected": self._conn is not None,
                "table": self._table_name if self._conn else "",
                "column_count": len(self._columns),
                "schema": self.get_schema(),
            }


# Global singleton instance
sql_executor = SQLExecutor()
