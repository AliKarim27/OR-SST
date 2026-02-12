# OR-SST Copilot Instructions

## Project Overview
**OR-SST** is an operating room transcription and information extraction pipeline:
- **Audio Input** → **Speech-to-Text (Whisper)** → **NER Extraction (Token Classifier)** → **Structured ORFormJSON Output**

This is a research project combining NLP (speech recognition + structured entity extraction) with a Django backend and React dashboard UI.

## Architecture & Data Flow

### Three-Stage Pipeline
1. **STT Stage** (`stt/`): Converts audio to text using OpenAI Whisper (faster-whisper library)
   - Audio resampled to 16kHz, normalized to mono
   - Factory pattern with multiple STT implementations
   - Database-backed model configuration
   
2. **Extraction Stage** (`extractor/`): Token-level classification using fine-tuned DistilBERT
   - Input: transcript string
   - Model: HuggingFace token-classification pipeline
   - Factory pattern with NERConfig for configuration
   - Output: raw entity spans with labels
   
3. **Post-Processing** (`extractor/postprocess.py`): Converts raw entities to validated schema
   - Input: entity list from model
   - Output: `ORFormJSON` Pydantic model (structured OR form data)
   - Complex normalization: dates, times, personnel mapping, medication parsing

### Factory Pattern Architecture
Both STT and NER modules use factory patterns for extensibility:
```python
# STT Factory (stt/factory.py)
from stt.factory import STTFactory
stt = STTFactory.create('whisper', 'base', 'cpu', 'int8')

# NER Factory (extractor/ner_factory.py)
from extractor.ner_factory import NERFactory
from extractor.base_ner import NERConfig
config = NERConfig(device='cpu', model_dir='models/slot_model')
ner = NERFactory.create('slot-filling', config)
```

### Data Schemas
- **Training Format** (`data/labels/`): JSONL files with `{"tokens": [...], "tags": [...]}` (BIO tagging scheme)
- **Label Map** (`data/label_map.json`): Ordered list of 37 BIO labels
- **Output Schema** (`extractor/schema.py`): `ORFormJSON` Pydantic model - rigidly defined operating room form with sections for personnel, times, diagnosis, procedures, vitals, medications

### Frontend/Backend
- **React Dashboard** (`react-material-ui/`): Material-UI based user interface
- **Django Backend** (`backend/`): Full REST API with model management, training, and inference endpoints

## Project Structure
```
OR-SST/
├── backend/                    # Django REST API
│   ├── api/
│   │   ├── models.py          # STTModel, NERModel database models
│   │   ├── views.py           # API endpoint handlers
│   │   └── urls.py            # URL routing
│   └── or_backend/            # Django settings
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
│   └── train_token_classifier.py
│
├── models/slot_model/          # Trained NER model
├── data/                       # Data files
│   ├── label_map.json         # BIO label definitions
│   ├── audio/                 # Audio files storage
│   └── labels/                # Training data (JSONL)
│
└── react-material-ui/          # React frontend
```

## Critical Developer Workflows

### Training a New Model
```bash
# 1. Prepare data in data/labels/train.jsonl with BIO tags
# 2. Update data/label_map.json with label names
python train/train_token_classifier.py
# → Saves model to models/slot_model/ with checkpoints
```
**Key Points:**
- Script auto-creates `dev.jsonl` (80/20 split) if missing
- Uses DistilBERT `distilbert-base-uncased` as base model
- Training args: 3 epochs, batch 16, lr 2e-5, max_length 512

### Running the Application
```bash
# Start Django backend (from backend/)
python manage.py runserver
# API available at http://localhost:8000/api/

# Start React dashboard (from react-material-ui/)
npm start
# Access: http://localhost:3000
```

### Data Preparation
JSONL format is strict: each line must be valid JSON with exact keys:
```json
{"tokens": ["word1", "word2", ...], "tags": ["O", "B-PROCEDURE", "I-PROCEDURE", ...]}
```
- Length of `tokens` must equal length of `tags`
- Tags must exist in `data/label_map.json`

## API Endpoints

### Core Pipeline
- `POST /api/transcribe_extract/` - Full pipeline: audio → text → entities
- `POST /api/transcribe_only/` - Audio transcription only
- `POST /api/ner/extract/` - Text to entity extraction

### Model Management
- `GET/POST /api/get_stt_models/`, `/api/set_stt_model/`, `/api/create_stt_model/`
- `GET/POST /api/ner/models/`, `/api/ner/models/create/`

### Training Data & Training
- `GET/POST /api/ner/data/`, `/api/ner/data/add/`, `/api/ner/data/update/`
- `POST /api/ner/training/start/`, `GET /api/ner/training/status/`

## Project-Specific Patterns & Conventions

### BIO Tagging (Not IOB)
- Uses **BIO** (Begin-Inside-Outside) scheme, not IOB
- `O` = outside any entity
- `B-LABEL` = beginning of new entity
- `I-LABEL` = inside/continuing entity
- **Never** mix: `I-PROCEDURE` cannot follow `O` in valid training data

### Pydantic-First Schema
- All structured data uses `ORFormJSON` from `extractor/schema.py`
- Post-processing must normalize to Pydantic types (dates as ISO strings, floats for vitals)
- Validation happens on instantiation; invalid data raises exceptions

### Text Normalization Conventions
- Dates: parsed flexibly (various formats) → normalized to `YYYY-MM-DD`
- Times: preserved as string (e.g., "08:30") using regex-based extraction
- Personnel: dictionary keys are standardized (e.g., `surgeon_1`, `anesthetist`)
- Medications: custom `Medication` class with optional dose/unit

### Import Paths
- Always use absolute imports from project root (e.g., `from extractor.model_infer import SlotFillingExtractor`)

## Critical Integration Points

### Model Directory Structure
```
models/slot_model/
  ├── config.json             # BERT config (auto from pretrained)
  ├── model.safetensors       # Model weights
  ├── tokenizer.json          # Tokenizer
  ├── vocab.txt               # Vocab
  ├── special_tokens_map.json # Special tokens
  └── checkpoint-X/           # Intermediate checkpoints
```
- `SlotFillingExtractor` loads from `MODEL_DIR` using HuggingFace's `from_pretrained()`
- If model doesn't exist, extractor returns `None` gracefully

### Audio Processing Pipeline
1. Load audio bytes → librosa.load (preserves sample rate)
2. Convert to mono: `np.mean(y, axis=0)` if multi-channel
3. Normalize: divide by max amplitude
4. Resample to 16kHz (Whisper requirement)
5. Pass to STT model via factory

### HuggingFace Transformers Setup
- Token classification pipeline uses `aggregation_strategy="simple"` (no sub-token merging)
- Tokenizer configured with `is_split_into_words=True` during training
- Special handling for word_ids mapping (`word_ids()` used to align labels to subword tokens like ##ed)

## Key Dependencies & Versions
- `transformers` (HuggingFace) - model loading, tokenizers, Trainer API
- `faster-whisper` - OpenAI Whisper optimized fork
- `datasets` (HuggingFace) - JSONL data loading, train/test splitting
- `torch` - deep learning backend
- `librosa` - audio processing
- `django + djangorestframework` - backend API
- `pydantic` - schema validation

## UI Guidelines (React Dashboard)
- Do not use emojis in UI copy, labels, or messages
- Use professional, domain-appropriate naming for pages, components, and labels
- Reuse existing theme elements and tokens from the React dashboard (colors, typography, spacing, and component styles)

## Debugging Tips
1. **Transcription issues** → Check audio preprocessing: librosa.load may fail on corrupted files
2. **Token mismatch errors** → Verify BIO tag count equals token count in JSONL
3. **Model loading fails** → Ensure `models/slot_model/` exists with all required files
4. **Entity extraction is empty** → Likely post-processing normalization failing (check date/time parsing)
5. **API errors** → Check Django logs, ensure migrations are run (`python manage.py migrate`)

## When to Modify Which Files
- **Add new entity types** → Update both `data/label_map.json` (BIO tags) AND `extractor/schema.py` (ORFormJSON dict)
- **Add new STT implementation** → Create new class in `stt/`, inherit from `BaseSTT`, register in `stt/factory.py`
- **Add new NER implementation** → Create new class in `extractor/`, inherit from `BaseNER`, register in `extractor/ner_factory.py`
- **Change tokenizer/model base** → Edit `train/train_token_classifier.py` (base_model line)
- **Adjust audio preprocessing** → Edit `stt/stt_whisper.py` (resampling, normalization)
- **Add post-processing logic** → Edit `extractor/postprocess.py` (normalization functions)
- **Add API endpoints** → Edit `backend/api/views.py` and `backend/api/urls.py`
