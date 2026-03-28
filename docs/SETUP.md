# InsightFlow AI — Setup Guide

## Step 1: Install Node dependencies
```powershell
npm install
```

## Step 2: Set up Python virtual environment

### Windows
```powershell
cd backend-py
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### macOS / Linux
```bash
cd backend-py
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ..
```

## Step 3: Start the app

### Windows
```powershell
npm run dev
```

### macOS / Linux
```bash
npm run dev:unix
```

## Step 4: Open browser
Go to **http://localhost:8080**

## Notes
- **First Run**: The system will download the Text-to-SQL model (~240MB). This requires internet once.
- **Persistence**: Your uploaded datasets are saved in `backend-py/data/` and will reload automatically on server restart.
- **Security**: The AI only has read access (SELECT only) to your data.
