import pandas as pd
import numpy as np
import re
from datetime import datetime

def _detect_column_type(df, col):
    series = df[col].dropna()
    if series.empty: return "text"
    
    # 1. Check numeric
    if pd.api.types.is_numeric_dtype(df[col]):
        if series.nunique() <= 2 and set(series.unique()).issubset({0, 1}):
            return "boolean"
        return "numeric"
    
    # 2. Check boolean strings
    bool_sets = [{'true', 'false'}, {'yes', 'no'}, {'y', 'n'}, {'t', 'f'}]
    str_series = series.astype(str).str.lower()
    unique_vals = set(str_series.unique())
    if any(unique_vals.issubset(s) for s in bool_sets):
        return "boolean"
        
    # 3. Check datetime
    if "date" in col.lower() or "time" in col.lower() or "year" in col.lower():
        return "datetime"
    
    # 4. Check categorical (Cardinality rule)
    if series.nunique() / len(df) < 0.3:
        return "categorical"
        
    return "text"

def profile(df: pd.DataFrame, filename: str) -> dict:
    columns = []
    kpis = []
    insights = []
    
    total_cells = df.size
    total_nulls = df.isnull().sum().sum()
    completeness = ((total_cells - total_nulls) / total_cells * 100) if total_cells > 0 else 0
    
    for col in df.columns:
        dtype = _detect_column_type(df, col)
        null_count = int(df[col].isnull().sum())
        col_completeness = (len(df) - null_count) / len(df) * 100
        unique_count = int(df[col].nunique())
        
        profile_data = {
            "name": col,
            "dtype": dtype,
            "null_count": null_count,
            "completeness": round(col_completeness, 1),
            "unique_count": unique_count,
            "sample_values": [str(x) for x in df[col].dropna().unique()[:5].tolist()]
        }
        
        if dtype == "numeric":
            stats = df[col].describe()
            mean = float(stats['mean'])
            std = float(stats['std']) if not np.isnan(stats['std']) else 0
            cv = (std / mean * 100) if mean != 0 else 0
            
            profile_data.update({
                "mean": round(mean, 2),
                "min": float(stats['min']),
                "max": float(stats['max']),
                "std": round(std, 2),
                "cv": round(cv, 1)
            })
            
            if cv > 50:
                insights.append(f"Column '{col}' shows high variability (CV: {round(cv, 1)}%)")
        
        if col_completeness < 80:
            insights.append(f"Column '{col}' has significant missing data ({round(col_completeness, 1)}% complete)")
            
        columns.append(profile_data)

    kpis.append({"label": "Total Records", "value": len(df)})
    kpis.append({"label": "Total Columns", "value": len(df.columns)})
    kpis.append({"label": "Overall Health", "value": f"{round(completeness, 1)}%"})
    
    # Suggestions logic
    suggestions = []
    cat_cols = [c["name"] for c in columns if c["dtype"] == "categorical"]
    num_cols = [c["name"] for c in columns if c["dtype"] == "numeric"]
    
    if cat_cols and num_cols:
        suggestions.append({
            "chart_type": "bar",
            "x_column": cat_cols[0],
            "y_column": num_cols[0],
            "reason": "Categorical distribution across numeric values."
        })
        
    return {
        "filename": filename,
        "row_count": len(df),
        "column_count": len(df.columns),
        "columns": columns,
        "kpis": kpis,
        "insights": insights[:6],
        "suggestions": suggestions,
        "loaded_at": datetime.now().isoformat()
    }
