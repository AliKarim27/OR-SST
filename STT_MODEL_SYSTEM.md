# STT Model Management System

## Overview

The OR-SST project now includes a robust, extensible STT (Speech-to-Text) model management system with:

- **Database-backed model configurations** - Store and manage multiple STT models
- **Factory pattern** - Easy to add new STT implementations
- **Validation system** - Ensure models are available before use
- **Web UI** - Manage models through the React dashboard

## Architecture

### Core Components

1. **BaseSTT** (`stt/base_stt.py`) - Abstract base class all STT implementations must inherit from
2. **STTFactory** (`stt/factory.py`) - Factory for creating and validating STT instances
3. **FasterWhisperSTT** (`stt/stt_whisper.py`) - Faster-Whisper implementation (default)
4. **STTModel** (`backend/api/models.py`) - Django model for database storage

### How It Works

```python
# 1. STT implementations inherit from BaseSTT
class FasterWhisperSTT(BaseSTT):
    def preprocess(self, audio_tuple): ...
    def transcribe(self, audio_data, language): ...
    def is_available(self): ...

# 2. Registered in the factory
STTFactory.register('whisper', FasterWhisperSTT)

# 3. Created with validation
stt = STTFactory.create('whisper', 'base', 'cpu', 'int8')

# 4. Used for transcription
audio_16k = stt.preprocess((sr, audio))
text = stt.transcribe(audio_16k, language='en')
```

## Adding a New STT Model Implementation

### Step 1: Create the Implementation

Create a new file in `stt/` directory:

```python
# stt/stt_custom.py
from .base_stt import BaseSTT
import numpy as np

class CustomSTT(BaseSTT):
    def __init__(self, model_name, device, compute_type):
        super().__init__(model_name, device, compute_type)
        # Initialize your model here
        
    def preprocess(self, audio_tuple):
        # Preprocess audio
        return processed_audio
        
    def transcribe(self, audio_data, language="en"):
        # Transcribe to text
        return text
        
    def is_available(self):
        # Check if dependencies are installed
        try:
            import your_library
            return True
        except ImportError:
            return False
```

### Step 2: Register in Factory

Edit `stt/factory.py` in the `_register_implementations()` function:

```python
def _register_implementations():
    # Existing registrations...
    
    # Add your implementation
    try:
        from .stt_custom import CustomSTT
        STTFactory.register('custom', CustomSTT)
    except ImportError as e:
        logging.warning(f"Could not register CustomSTT: {e}")
```

### Step 3: Use in UI

The new model type will automatically appear in:
- The "Add Model" dialog dropdown
- Validation will check if dependencies are available
- Can be selected and activated like any other model

## Database Schema

```sql
CREATE TABLE api_sttmodel (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) UNIQUE,           -- Model identifier (base, small, etc.)
    model_type VARCHAR(50),              -- Type (whisper, custom, etc.)
    device VARCHAR(20),                  -- cpu or cuda
    compute_type VARCHAR(20),            -- int8, float16, float32
    is_active BOOLEAN,                   -- Currently active model
    is_default BOOLEAN,                  -- Default model
    description TEXT,                    -- User-friendly description
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

## API Endpoints

### Get All Models
```http
GET /api/get_stt_models/
Response: { models: [...], current_model: "base", current_model_id: 1 }
```

### Set Active Model
```http
POST /api/set_stt_model/
Body: { model_id: 1 }
Response: { status: "...", current_model: "base" }
```

### Create New Model
```http
POST /api/create_stt_model/
Body: {
    name: "small",
    model_type: "whisper",
    device: "cpu",
    compute_type: "int8",
    description: "..."
}
Response: { status: "...", model: {...}, warnings: [...] }
```

### Validate Model Configuration
```http
POST /api/validate_stt_model/
Body: {
    model_type: "whisper",
    model_name: "base",
    device: "cpu",
    compute_type: "int8"
}
Response: {
    valid: true,
    available: true,
    message: "...",
    warnings: [...]
}
```

### Get Available Types
```http
GET /api/get_stt_types/
Response: { types: ["whisper", "faster-whisper"], default_type: "whisper" }
```

### Delete Model
```http
POST /api/delete_stt_model/
Body: { model_id: 3 }
Response: { status: "Model deleted successfully" }
```

## Default Models

On first run, 5 Whisper models are auto-created:

| Name   | Description                                      | Default | Active |
|--------|--------------------------------------------------|---------|--------|
| tiny   | Fastest, lowest accuracy                         | No      | No     |
| base   | Balanced speed and accuracy (recommended)        | Yes     | Yes    |
| small  | Better accuracy, slower                          | No      | No     |
| medium | High accuracy, significantly slower              | No      | No     |
| large  | Best accuracy, slowest, needs more resources     | No      | No     |

## Validation System

Before creating or activating a model, the system validates:

1. **Type exists** - Is the model type registered in the factory?
2. **Dependencies available** - Are required libraries installed?
3. **Device compatibility** - Is CUDA available if specified?
4. **Model downloadable** - Can the model be downloaded (checked on first use)?

Warnings are shown for:
- CUDA requested but not available (falls back to CPU)
- Large models requiring significant resources

## Web UI Features

### STT Model Settings Page

Access via sidebar: **STT Model Settings**

Features:
- View all configured models
- See active model with visual indicator
- Click to select, button to activate
- Add new models with validation
- Delete non-active/non-default models
- Real-time validation feedback
- Warning messages for configuration issues

## Troubleshooting

### Model fails to load
- Check `is_available()` returns True
- Verify dependencies are installed: `pip install faster-whisper`
- Check model_name is valid for that STT type

### CUDA not working
- Ensure PyTorch with CUDA support is installed
- Verify GPU is available: `python -c "import torch; print(torch.cuda.is_available())"`
- System will fall back to CPU automatically

### Database errors
- Run migrations: `python manage.py makemigrations && python manage.py migrate`
- Default models will auto-populate on first API call

## Example: Adding Multiple Model Types

```python
# Same interface, different implementations
stt_fast = STTFactory.create('faster-whisper', 'base', 'cpu', 'int8')
stt_openai = STTFactory.create('openai-whisper', 'small', 'cuda', 'float16')
stt_custom = STTFactory.create('custom', 'v1', 'cpu', 'int8')

# All work the same way
for stt in [stt_fast, stt_openai, stt_custom]:
    audio_16k = stt.preprocess((sr, audio))
    text = stt.transcribe(audio_16k, language='en')
```

## Best Practices

1. **Always validate** before creating models in production
2. **Use factory** instead of direct instantiation
3. **Implement is_available()** properly to check dependencies
4. **Handle errors** gracefully - factory returns None on failure
5. **Set meaningful descriptions** to help users choose models
6. **Test new implementations** with validate_stt_model endpoint first

## Future Enhancements

Possible additions:
- Cloud-based STT (Google, AWS, Azure)
- Stream processing for real-time transcription
- Model performance metrics (speed, accuracy)
- A/B testing between models
- Auto-selection based on audio characteristics
