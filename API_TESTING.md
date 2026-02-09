# Testing NER API Endpoints

## Start the Backend

The backend is already running on http://127.0.0.1:8000/

## Test Endpoints

### 1. Get NER Models
```bash
curl http://localhost:8000/api/ner/models/
```

### 2. Get Training Data
```bash
curl http://localhost:8000/api/ner/data/
```

### 3. Get Data Statistics
```bash
curl http://localhost:8000/api/ner/data/stats/
```

### 4. Create New Model
```bash
curl -X POST http://localhost:8000/api/ner/models/create/ \
  -H "Content-Type: application/json" \
  -d '{"name": "test_model", "model_type": "slot-filling", "device": "cpu"}'
```

### 5. Add Training Entry
```bash
curl -X POST http://localhost:8000/api/ner/data/add/ \
  -H "Content-Type: application/json" \
  -d '{"tokens": ["test", "entry"], "tags": ["O", "O"]}'
```

## Start the React Frontend

In a new terminal:
```bash
cd react-material-ui
npm start
```

## API Integration Complete

All mock API calls have been replaced with real backend endpoints:

### Model Management (NERModelManagement.js)
- ✅ `loadModels()` → `GET /api/ner/models/`
- ✅ `handleCreateModel()` → `POST /api/ner/models/create/`
- ✅ `handleDeleteModel()` → `POST /api/ner/models/delete/`

### Training Data (NERDataManagement.js)
- ✅ `loadData()` → `GET /api/ner/data/`
- ✅ `handleSave()` → `POST /api/ner/data/add/` or `/update/`
- ✅ `handleDelete()` → `POST /api/ner/data/delete/`

### Training Stats (NERTraining.js)
- ✅ `loadDataStats()` → `GET /api/ner/data/stats/`

## Database Schema

NERModel table created with fields:
- name (unique)
- model_type
- model_path
- device
- is_active
- status
- description
- created_at
- updated_at
