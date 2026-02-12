# OR-SST: Operating Room Speech-to-Text and Information Extraction Pipeline

OR-SST is an AI-powered operating room transcription and information extraction system. It combines speech-to-text (STT) transcription with Named Entity Recognition (NER) to automatically process surgical procedure recordings and extract structured data.

## Overview

```
Audio Input -> Speech-to-Text (Whisper) -> NER Extraction (Token Classifier) -> Structured ORFormJSON Output
```

The pipeline transforms audio recordings from operating room procedures into structured, validated JSON data containing personnel information, timing, diagnoses, procedures, vital signs, and more.

## Features

- **Speech-to-Text (STT)**: Multiple STT model support with factory pattern architecture
  - Whisper models (tiny, base, small, medium, large)
  - Wav2Vec2 support
  - Database-backed model configuration management
  
- **Named Entity Recognition (NER)**: Token-level classification for medical entity extraction
  - Fine-tuned DistilBERT token classifier
  - 37 entity types (BIO tagging scheme)
  - Configurable confidence thresholds
  
- **Django REST API**: Full-featured backend with endpoints for:
  - Audio transcription and entity extraction
  - Model management (STT and NER)
  - Training data management
  - Model training orchestration
  
- **React Dashboard**: Modern Material-UI based interface for:
  - Audio upload and playback
  - Real-time transcription
  - Entity extraction visualization
  - Model and training management

## Architecture

### Three-Stage Pipeline

1. **STT Stage** (`stt/`): Converts audio to text using OpenAI Whisper
   - Audio resampled to 16kHz, normalized to mono
   - Factory pattern for multiple STT implementations
   
2. **Extraction Stage** (`extractor/`): Token-level NER classification
   - DistilBERT-based token classifier
   - HuggingFace transformers pipeline
   
3. **Post-Processing** (`extractor/postprocess.py`): Schema validation and normalization
   - Date/time normalization
   - Personnel mapping
   - Medication parsing
   - Output: validated `ORFormJSON` Pydantic model

### Factory Pattern Design

Both STT and NER modules follow a factory pattern for extensibility:

```python
# STT Factory
from stt.factory import STTFactory
stt = STTFactory.create('whisper', 'base', 'cpu', 'int8')
text = stt.transcribe(audio_data, language='en')

# NER Factory
from extractor.ner_factory import NERFactory
from extractor.base_ner import NERConfig
config = NERConfig(device='cpu', model_dir='models/slot_model')
ner = NERFactory.create('slot-filling', config)
entities = ner.extract(transcript)
```

## Installation

### Prerequisites
- Python 3.10+
- Node.js 18+
- CUDA (optional, for GPU acceleration)

### Backend Setup

```bash
# Clone the repository
git clone <repository-url>
cd OR-SST

# Create virtual environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate
# Activate (macOS/Linux)
source .venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Run database migrations
cd backend
python manage.py migrate
cd ..
```

### Frontend Setup

```bash
cd react-material-ui
npm install
```

## Running the Application

### Start the Backend Server

```bash
cd backend
python manage.py runserver
```

The API will be available at `http://localhost:8000/api/`

### Start the Frontend

```bash
cd react-material-ui
npm start
```

Access the dashboard at `http://localhost:3000`

## Project Structure

```
OR-SST/
├── backend/                    # Django REST API
│   ├── api/
│   │   ├── models.py          # STTModel, NERModel database models
│   │   ├── views.py           # API endpoint handlers
│   │   └── urls.py            # URL routing
│   ├── or_backend/
│   │   └── settings.py        # Django configuration
│   └── manage.py
│
├── stt/                        # Speech-to-Text module
│   ├── base_stt.py            # Abstract base class for STT
│   ├── factory.py             # STT factory pattern
│   ├── stt_whisper.py         # Faster-Whisper implementation
│   └── stt_wav2vec.py         # Wav2Vec2 implementation
│
├── extractor/                  # NER/Entity Extraction module
│   ├── base_ner.py            # Abstract base class + NERConfig
│   ├── ner_factory.py         # NER factory pattern
│   ├── model_infer.py         # SlotFillingExtractor implementation
│   ├── postprocess.py         # Entity postprocessing
│   ├── schema.py              # ORFormJSON Pydantic schema
│   └── correction_manager.py  # Entity correction utilities
│
├── train/                      # Training scripts
│   └── train_token_classifier.py  # Token classifier training
│
├── models/                     # Model storage
│   └── slot_model/            # Trained NER model
│       ├── config.json
│       ├── model.safetensors
│       ├── tokenizer.json
│       └── checkpoint-*/      # Training checkpoints
│
├── data/                       # Data files
│   ├── label_map.json         # BIO label definitions (37 labels)
│   ├── audio/                 # Audio files storage
│   └── labels/
│       ├── train.jsonl        # Training data
│       └── dev.jsonl          # Validation data
│
├── react-material-ui/          # React frontend
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Page components
│   │   ├── services/          # API service layer
│   │   └── theme.js           # Material-UI theme
│   └── package.json
│
├── requirements.txt            # Python dependencies
├── STT_MODEL_SYSTEM.md        # STT module documentation
├── NER_MODEL_SYSTEM.md        # NER module documentation
└── API_TESTING.md             # API testing guide
```

## API Endpoints

### Core Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health/` | GET | Health check |
| `/api/transcribe_extract/` | POST | Full pipeline: audio -> text -> entities |
| `/api/transcribe_only/` | POST | Audio transcription only |
| `/api/ner/extract/` | POST | Text to entity extraction |

### STT Model Management
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/get_stt_models/` | GET | List all STT models |
| `/api/set_stt_model/` | POST | Set active STT model |
| `/api/create_stt_model/` | POST | Create new STT model config |
| `/api/delete_stt_model/` | POST | Delete STT model config |
| `/api/validate_stt_model/` | POST | Validate model availability |
| `/api/get_stt_types/` | GET | List available STT types |

### NER Model Management
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ner/models/` | GET | List all NER models |
| `/api/ner/models/create/` | POST | Create new NER model config |
| `/api/ner/models/delete/` | POST | Delete NER model config |

### Training Data Management
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ner/data/` | GET | Get training data entries |
| `/api/ner/data/add/` | POST | Add training entry |
| `/api/ner/data/update/` | POST | Update training entry |
| `/api/ner/data/delete/` | POST | Delete training entry |
| `/api/ner/data/stats/` | GET | Get dataset statistics |
| `/api/ner/entity-types/` | GET | List entity types |
| `/api/ner/available-tags/` | GET | Get available BIO tags |

### Training Control
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ner/training/start/` | POST | Start model training |
| `/api/ner/training/status/` | GET | Get training status |
| `/api/ner/training/stop/` | POST | Stop training |

### Audio Management
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload_audio/` | POST | Upload audio file |
| `/api/list_audio/` | GET | List audio files |
| `/api/get_audio/` | GET | Download audio file |
| `/api/delete_audio/` | POST | Delete audio file |

## Entity Types

The system extracts 37 entity types using BIO tagging:

| Category | Entities |
|----------|----------|
| **Temporal** | DATE, TIME |
| **Personnel** | PERSON_SURGEON, PERSON_ANESTHETIST, PERSON_ASSISTANT, PERSON_NURSE, PERSON_TECH |
| **Clinical** | DIAGNOSIS, PROCEDURE, OP_CODE, ANESTHESIA_TYPE, WOUND_CLASS |
| **Vitals** | BP_SYS, BP_DIA, HR, SPO2 |
| **Quantities** | AMOUNT, COUNT, DOSE, UNIT |
| **Equipment** | LINE_DEVICE, TUBE_DEVICE, SUPPLY_ITEM |
| **Outcomes** | PATIENT_CONDITION, CONDITION, DESTINATION, OUTCOME, COMPLICATION |
| **Other** | POSITION, SPECIMEN_TYPE, IRRIGATION_TYPE, DRUG, NEWBORN, OR_ROOM, ALLERGY |

## Training a Model

### Prepare Training Data

Create JSONL files with BIO-tagged data:

```json
{"tokens": ["Dr", "Smith", "performed", "appendectomy"], "tags": ["B-PERSON_SURGEON", "I-PERSON_SURGEON", "O", "B-PROCEDURE"]}
```

### Run Training

```bash
python train/train_token_classifier.py
```

Training configuration:
- Base model: `distilbert-base-uncased`
- Epochs: 3
- Batch size: 16
- Learning rate: 2e-5
- Max sequence length: 512

The trained model is saved to `models/slot_model/`.

## Dependencies

### Python (requirements.txt)
- `torch` - Deep learning backend
- `transformers` - HuggingFace model loading and training
- `faster-whisper` - Optimized Whisper implementation
- `datasets` - Data loading utilities
- `librosa` - Audio processing
- `pydantic` - Schema validation
- `django` + `djangorestframework` - Backend API
- `seqeval` - NER evaluation metrics

### Frontend (package.json)
- React 19
- Material-UI 6
- ApexCharts
- React Router

## Documentation

- [STT_MODEL_SYSTEM.md](STT_MODEL_SYSTEM.md) - STT module architecture and extension guide
- [NER_MODEL_SYSTEM.md](NER_MODEL_SYSTEM.md) - NER module architecture and extension guide
- [API_TESTING.md](API_TESTING.md) - API testing and examples

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License



## Contact

ali.karim.2@outlook.com
