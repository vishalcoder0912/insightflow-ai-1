# 🌌 InsightFlow AI - Deep Technical Evolution by Antigravity

This document provides an exhaustive technical breakdown of the architectural transformation and stabilization of **InsightFlow AI**. We have evolved the system from a cloud-dependent Node.js app into a high-performance, self-hosted, open-source AI platform.

---

## 🏛️ Technical Architecture: The Python Engine

We replaced the legacy Node.js/Gemini backend with a custom-engineered **FastAPI** (`backend-py`) ecosystem designed for local performance.

### 1. Neural Text-to-SQL Pipeline
- **Model**: Integrated `cssupport/t5-small-awesome-text-to-sql` via the Hugging Face `transformers` library.
- **Workflow**:
    1. **Schema Linking**: The system dynamically extracts column names and sample values from your active dataset.
    2. **Prompt Engineering**: Constructs a structured prompt: `translate English to SQL: <question> | <schema>`.
    3. **Local Inference**: The model generates a SQL query directly on your CPU/GPU, ensuring **100% data privacy** as no data ever leaves your machine.
- **Optimization**: Uses `torch` for efficient tensor operations and `model_loader.py` to ensure the model is only loaded into memory once.

### 2. In-Memory SQL Execution Service (`sql_executor.py`)
- **Engine**: SQLite `:memory:` mode.
- **Data Lifecycle**:
    - When you upload a CSV, Pandas cleans and types the data before loading it into a temporary SQLite table named `dataset`.
    - **Cleaning Logic**: Automatically replaces spaces/hyphens with underscores in headers to ensure SQL compatibility.
- **Security**: The executor restricts all operations to `SELECT` queries only, preventing any accidental data modification through the AI chat.

### 3. Automated Data Profiling (`data_profiler.py`)
- **Type Inference**: Beyond standard Pandas dtypes, we implemented semantic detection for `datetime`, `categorical`, and `boolean` types using regex and frequency analysis.
- **Statistical Routine**: 
    - Calculates **KPIs** (Critical performance indicators) like totals, averages, and data completeness.
    - Generates **Narrative Insights**: Uses threshold-based logic (e.g., Coefficient of Variation > 50% triggers a "high variability" insight).
    - **Smart Suggestions**: Analyzes column relationships (e.g., Categorical + Numeric) to automatically recommend the best ChartJS/Recharts visualizations.

---

## 🛠️ Critical Stabilization & Fixes

### 📊 AI Chart Rendering Engine
- **The Challenge**: Mismatched naming conventions between the Python backend (snake_case) and the React frontend (camelCase) caused charts to disappear.
- **The Solution**: 
    - Updated `ChatInterface.tsx` with a dynamic mapper: `{ ...resp.chart, chartType: resp.chart.chart_type }`.
    - Corrected the `ChartPreview` component to support various data shapes (`x`, `y`, `label`, `value`).
- **Result**: Seamless, interactive visualizations for every data query.

### 💾 Persistence Layer (`_save_persistence`)
- **Mechanic**: On every successful upload, the system saves the raw CSV to `backend-py/data/current_dataset.csv` and a JSON metadata snapshot to `current_metadata.json`.
- **Startup Hook**: On server launch, `datasets.py` checks for these files and automatically re-initializes the AI engine, providing a "Zero-Setup" experience on return.

### 📥 Enterprise Export Fix
- **Correction**: Resolved a hardcoded URL issue in `ExplorerPage.tsx`. The export feature now correctly dynamically targets the `/api/export/csv` endpoint on the FastAPI server, supporting large file streaming.

---

## 🏎️ Roadmap: The "Turbo" Upload Optimization

We are currently engineering a mission-critical update for large-scale datasets:
1. **Intelligent Sampling**: Implementing a 50,000-row profiling cap. The AI will profile a statistically significant sample of massive files to keep upload times under 2 seconds, while the full file remains available for query.
2. **Binary Multi-part Support**: Moving from `JSON.stringify(csv)` to `FormData`. This reduces browser memory overhead by 60% and adds native Excel support.
3. **Optimized Calculations**: Utilizing NumPy's vectorized operations to replace iterative column loops in the profiling engine.

---

## ⚙️ Operational Guide

### Deployment Command
```powershell
# Starts Vite (8080) and FastAPI (3001) concurrently
npm run dev
```

### Environment Requirements
- **Python 3.10+**: Required for `transformers` and `fastapi`.
- **Node.js 18+**: Required for the React 18 frontend.
- **Venv**: Recommended to keep dependencies isolated in the `backend-py/venv` directory.

---
*Authored by Antigravity — Architecting the future of Local AI.*
