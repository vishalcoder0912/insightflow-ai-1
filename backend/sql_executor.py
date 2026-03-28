import sqlite3
import pandas as pd
import re

def clean_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [
        re.sub(r'[\s\-]+', '_', col).lower().strip('_')
        for col in df.columns
    ]
    return df

def execute_query(df: pd.DataFrame, sql: str) -> list[dict]:
    stripped = sql.strip().upper()
    if not stripped.startswith("SELECT"):
        raise ValueError("Only SELECT queries are permitted.")
    
    df_clean = clean_columns(df)
    conn = sqlite3.connect(":memory:")
    try:
        df_clean.to_sql("dataset", conn, index=False, if_exists="replace")
        cursor = conn.execute(sql)
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        return [dict(zip(columns, row)) for row in rows]
    except sqlite3.Error as e:
        raise RuntimeError(f"SQL execution error: {e}")
    finally:
        conn.close()
