# InsightFlow AI - Complete Setup Guide

## Project Status: ✅ FULLY FUNCTIONAL

Your InsightFlow AI project has been successfully debugged and is now fully operational!

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Python 3.12+
- Git

### 1. Install Dependencies

```bash
# Root dependencies
npm install

# Frontend dependencies  
cd frontend
npm install
cd ..

# Python backend dependencies
cd backend-py
pip install -r requirements.txt
cd ..
```

### 2. Start the Application

```bash
# Start both frontend and backend simultaneously
npm run dev
```

Or start individually:

```bash
# Backend (Port 3001)
cd backend-py
python main.py

# Frontend (Port 8080) - in separate terminal
cd frontend  
npm run dev
```

### 3. Access the Application

- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:3001
- **API Documentation**: http://localhost:3001/docs

## 📊 Features Working

### ✅ Core Features
- [x] CSV file upload with drag & drop
- [x] Data profiling and analysis
- [x] Interactive dashboard with charts
- [x] Natural language queries (basic SQL generation)
- [x] Data visualization (bar, line, pie charts)
- [x] Real-time data exploration
- [x] Responsive design

### ✅ Technical Features
- [x] React 18 + TypeScript frontend
- [x] FastAPI Python backend
- [x] Hot reload for development
- [x] CORS properly configured
- [x] Error handling and validation
- [x] Modern UI with TailwindCSS + Radix UI

## 🔧 Configuration

### Environment Variables
Copy `.env.example` to `.env` and configure:

```bash
# Frontend
VITE_API_BASE_URL=                    # Leave empty for development
VITE_DEV_PROXY_TARGET=               # Auto-configured

# Backend
PORT=3001
CORS_ORIGIN=*
```

### Database (Optional)
The app works without a database. For production, configure PostgreSQL in `.env`:

```bash
PGHOST=127.0.0.1
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=insightflow_ai
```

## 🧪 Testing

### Test API Endpoints
```bash
# Check dataset info
curl http://localhost:3001/api/dataset/info

# Test upload (with test_data.csv)
curl -X POST -F "file=@test_data.csv" http://localhost:3001/api/upload

# Test query
curl -X POST -H "Content-Type: application/json" \
  -d '{"question": "count by city"}' \
  http://localhost:3001/api/query
```

### Test Frontend
1. Open http://localhost:8080
2. Navigate to Upload page
3. Upload the provided `test_data.csv`
4. View dashboard with analytics
5. Try natural language queries

## 🐛 Troubleshooting

### Common Issues

**Port already in use**
```bash
# Kill processes on ports 3001 and 8080
netstat -ano | findstr :3001
netstat -ano | findstr :8080
taskkill /F /PID <PID>
```

**Python dependencies not found**
```bash
cd backend-py
pip install -r requirements.txt
```

**Frontend build errors**
```bash
cd frontend
npm install
npm run build
```

**Backend not responding**
- Check if Python process is running
- Verify port 3001 is not blocked
- Check backend console for errors

## 📁 Project Structure

```
insightflow-ai/
├── frontend/                 # React + Vite application
│   ├── src/
│   │   ├── features/        # Feature modules (dashboard, upload, chat)
│   │   ├── components/      # Reusable UI components  
│   │   ├── shared/          # Shared services and types
│   │   └── app/             # App routing and layout
├── backend-py/              # Python FastAPI backend
│   ├── main.py              # FastAPI application
│   ├── data_profiler.py     # Data analysis
│   ├── model_loader.py      # SQL generation (with fallback)
│   └── requirements.txt     # Python dependencies
├── test_data.csv            # Sample dataset for testing
└── package.json             # Root scripts and dependencies
```

## 🚀 Deployment

### Frontend (Static)
```bash
cd frontend
npm run build
# Deploy dist/ folder to any static hosting
```

### Backend (Production)
```bash
cd backend-py
pip install gunicorn
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 📄 License

This project is open source and available under the MIT License.

## 🆘 Support

If you encounter any issues:

1. Check this guide first
2. Review console logs for errors
3. Verify all dependencies are installed
4. Ensure ports 3001 and 8080 are available

---

**Status**: ✅ Project is fully debugged and ready for use!
