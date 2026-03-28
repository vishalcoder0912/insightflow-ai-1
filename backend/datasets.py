import pandas as pd
import json
import os
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
CSV_PATH = os.path.join(DATA_DIR, "current_dataset.csv")
META_PATH = os.path.join(DATA_DIR, "current_metadata.json")

current_df: pd.DataFrame = None
current_metadata: dict = None

def set_dataset(df: pd.DataFrame, metadata: dict):
    global current_df, current_metadata
    current_df = df
    current_metadata = metadata

def get_dataset():
    return current_df

def get_metadata():
    return current_metadata

def get_schema_string(df: pd.DataFrame) -> str:
    schema_parts = []
    for col in df.columns:
        samples = df[col].dropna().unique()[:3].tolist()
        schema_parts.append(f"{col} ({', '.join(map(str, samples))})")
    return ", ".join(schema_parts)

def _save_persistence(df: pd.DataFrame, metadata: dict):
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
    
    df.to_csv(CSV_PATH, index=False)
    with open(META_PATH, "w") as f:
        json.dump(metadata, f)

def _load_persistence():
    global current_df, current_metadata
    if os.path.exists(CSV_PATH) and os.path.exists(META_PATH):
        try:
            current_df = pd.read_csv(CSV_PATH)
            with open(META_PATH, "r") as f:
                current_metadata = json.load(f)
            print("[Datasets] Restored previous session.")
            return True
        except Exception as e:
            print(f"[Datasets] Persistence load failed: {e}")
    return False
