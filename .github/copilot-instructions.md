# OR-SST Copilot Instructions

## Project Overview
**AI-OR** is an operating room transcription and information extraction pipeline:
- **Audio Input** → **Speech-to-Text (Whisper)** → **Slot Filling Extraction (Token Classifier)** → **Structured ORFormJSON Output**

This is a research project combining NLP (speech recognition + structured entity extraction) with a Django backend and React dashboard UI.

## Architecture & Data Flow

### Three-Stage Pipeline
1. **STT Stage** (`stt/stt_whisper.py`): Converts audio to text using OpenAI Whisper (faster-whisper library)
   - Audio resampled to 16kHz, normalized
   - Outputs raw transcript string
   
2. **Extraction Stage** (`extractor/model_infer.py`): Token-level classification using fine-tuned DistilBERT
   - Input: transcript string
   - Model: HuggingFace token-classification pipeline
   - Output: raw entity spans with labels
   
3. **Post-Processing** (`extractor/postprocess.py`): Converts raw entities to validated schema
   - Input: entity list from model
   - Output: `ORFormJSON` Pydantic model (structured OR form data)
   - Complex normalization: dates, times, personnel mapping, medication parsing

### Data Schemas
- **Training Format** (`data/labels/`): JSONL files with `{"tokens": [...], "tags": [...]}` (BIO tagging scheme)
- **Label Map** (`data/label_map.json`): Ordered list of BIO labels (e.g., `["O", "B-DATE", "I-DATE", "B-MEDICATION", ...]`)
- **Output Schema** (`extractor/schema.py`): `ORFormJSON` Pydantic model - rigidly defined operating room form with sections for personnel, times, diagnosis, procedures, vitals, medications

### Frontend/Backend
- **React Dashboard** (`react-material-ui/`): Main user interface
- **Django Backend** (`backend/or_backend/`): REST API for serving models (currently minimal setup)

## Critical Developer Workflows

### Training a New Model
```bash
# 1. Prepare data in data/labels/train.jsonl with BIO tags
# 2. Update data/label_map.json with label names
python train/train_token_classifier.py
# → Saves model to models/slot_model/ with checkpoints every N steps
```
**Key Points:**
- Script auto-creates `dev.jsonl` (80/20 split) if missing
- Uses DistilBERT `distilbert-base-uncased` as base model
- Training args: 3 epochs, batch 16, lr 2e-5, max_length 512

### Running the Application
```bash
# Run the React dashboard (from react-material-ui/)
npm start
# Access: http://localhost:3000
```

### Data Preparation
JSONL format is strict: each line must be valid JSON with exact keys:
```json
{"tokens": ["word1", "word2", ...], "tags": ["O", "B-MEDICATION", "I-MEDICATION", ...]}
```
- Length of `tokens` must equal length of `tags`
- Tags must exist in `data/label_map.json`

## Project-Specific Patterns & Conventions

### BIO Tagging (Not IOB)
- Uses **BIO** (Begin-Inside-Outside) scheme, not IOB
- `O` = outside any entity
- `B-LABEL` = beginning of new entity
- `I-LABEL` = inside/continuing entity
- **Never** mix: `I-MEDICATION` cannot follow `O` in valid training data

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
5. Pass to Whisper model

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

## When to Modify Which Files
- **Add new entity types** → Update both `data/label_map.json` (BIO tags) AND `extractor/schema.py` (ORFormJSON dict)
- **Change tokenizer/model base** → Edit `train/train_token_classifier.py` (base_model line)
- **Adjust audio preprocessing** → Edit `stt/stt_whisper.py` (resampling, normalization)
- **Add post-processing logic** → Edit `extractor/postprocess.py` (normalization functions)
