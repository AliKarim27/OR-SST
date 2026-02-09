# NER Module System

## Overview

The NER (Named Entity Recognition) module for OR-SST follows a factory pattern design similar to the STT module, providing a clean and extensible architecture for entity extraction from medical transcripts.

## Architecture

### Component Hierarchy

```
BaseNER (Abstract Base Class)
    ↓
SlotFillingExtractor (Concrete Implementation)
    ↓
NERFactory (Factory Pattern)
    ↓
NERConfig (Configuration Management)
```

### Directory Structure

```
extractor/
    ├── __init__.py                  # Public API exports
    ├── base_ner.py                  # BaseNER abstract class + NERConfig
    ├── ner_factory.py               # Factory for creating NER instances
    ├── model_infer.py               # SlotFillingExtractor implementation
    ├── postprocess.py               # Entity postprocessing utilities
    ├── schema.py                    # ORFormJSON Pydantic schema
    ├── NER_USAGE_EXAMPLES.py        # Usage examples
    └── USAGE_EXAMPLES.py            # Legacy usage examples
```

## Core Components

### 1. BaseNER (Abstract Base Class)

**Location:** `extractor/base_ner.py`

The abstract base class that all NER implementations must inherit from.

**Abstract Methods:**
- `extract(transcript: str) -> dict`: Extract entities from text
- `is_available() -> bool`: Check if implementation is ready to use
- `get_model_info() -> Dict[str, str]`: Get model metadata

**Optional Methods:**
- `preprocess(text: str) -> str`: Preprocess input text
- `postprocess(entities: list, original_text: str) -> dict`: Postprocess entities
- `get_config() -> NERConfig`: Get current configuration

### 2. NERConfig (Configuration Dataclass)

**Location:** `extractor/base_ner.py`

Centralized configuration for NER models.

**Attributes:**
```python
model_type: str = "slot-filling"           # Model type identifier
model_dir: str = "models/slot_model"       # Path to model files
device: str = "cpu"                        # Device: 'cpu' or 'cuda'
aggregation_strategy: str = "simple"       # Token aggregation strategy
max_length: int = 512                      # Maximum sequence length
batch_size: int = 1                        # Batch size for inference
confidence_threshold: float = 0.5          # Minimum confidence score
```

**Methods:**
- `to_dict() -> Dict`: Convert to dictionary
- `from_dict(config_dict: Dict) -> NERConfig`: Create from dictionary

### 3. NERFactory (Factory Pattern)

**Location:** `extractor/ner_factory.py`

Factory class for creating and validating NER instances.

**Key Methods:**

#### `register(model_type: str, ner_class: type)`
Register a new NER implementation.
```python
NERFactory.register('custom', CustomNERClass)
```

#### `create(model_type: str, config: NERConfig) -> Optional[BaseNER]`
Create a NER instance.
```python
config = NERConfig(device='cuda')
ner = NERFactory.create('slot-filling', config)
```

#### `validate_model(model_type: str, config: NERConfig) -> Dict`
Validate configuration before creation.
```python
validation = NERFactory.validate_model('slot-filling', config)
# Returns: {'valid': bool, 'available': bool, 'message': str, 'warnings': list}
```

#### `get_available_types() -> List[str]`
List all registered NER types.
```python
types = NERFactory.get_available_types()
# Returns: ['slot-filling', 'distilbert']
```

### 4. SlotFillingExtractor (Concrete Implementation)

**Location:** `extractor/model_infer.py`

Token-level NER using fine-tuned DistilBERT for medical entity extraction.

**Features:**
- Uses HuggingFace transformers pipeline
- Token classification with BIO tagging
- Automatic entity aggregation
- Postprocessing to structured ORFormJSON format

## Usage Patterns

### Basic Usage

```python
from extractor import NERFactory, NERConfig

# Create configuration
config = NERConfig()

# Create NER instance
ner = NERFactory.create('slot-filling', config)

# Extract entities
transcript = "Surgery date was January 15th 2025. Surgeon was Dr. Smith."
result = ner.extract(transcript)
```

### Custom Configuration

```python
config = NERConfig(
    model_dir='models/slot_model',
    device='cuda',
    confidence_threshold=0.7,
    batch_size=4
)

validation = NERFactory.validate_model('slot-filling', config)
if validation['available']:
    ner = NERFactory.create('slot-filling', config)
```

### Configuration from File

```python
import json

# Load from JSON
with open('ner_config.json', 'r') as f:
    config_dict = json.load(f)

config = NERConfig.from_dict(config_dict)
ner = NERFactory.create('slot-filling', config)
```

### Error Handling

```python
# Validate before creation
validation = NERFactory.validate_model('slot-filling', config)

if not validation['valid']:
    print(f"Invalid configuration: {validation['message']}")
elif not validation['available']:
    print(f"Model not available: {validation['message']}")
else:
    if validation['warnings']:
        print(f"Warnings: {validation['warnings']}")
    
    ner = NERFactory.create('slot-filling', config)
    if ner:
        result = ner.extract(transcript)
```

## Extending the System

### Creating a Custom NER Implementation

```python
from extractor import BaseNER, NERConfig, NERFactory

class CustomNER(BaseNER):
    """Custom NER implementation"""
    
    def __init__(self, config: NERConfig):
        super().__init__(config)
        # Initialize your model here
        self.model = self._load_model()
    
    def extract(self, transcript: str) -> dict:
        """Extract entities using custom logic"""
        # Your extraction logic
        entities = self.model.predict(transcript)
        return self.postprocess(entities, transcript)
    
    def is_available(self) -> bool:
        """Check if model is loaded"""
        return self.model is not None
    
    def get_model_info(self) -> dict:
        """Return model metadata"""
        return {
            'status': 'available',
            'type': 'custom',
            'model_dir': self.config.model_dir
        }
    
    def _load_model(self):
        """Load your model"""
        # Custom model loading logic
        pass

# Register the implementation
NERFactory.register('custom', CustomNER)

# Use it
config = NERConfig(model_type='custom')
ner = NERFactory.create('custom', config)
```

## Auto-Registration

The factory automatically registers available implementations on module load:

```python
# In ner_factory.py
def _register_implementations():
    """Auto-register all available NER implementations"""
    try:
        from .model_infer import SlotFillingExtractor
        NERFactory.register('slot-filling', SlotFillingExtractor)
        NERFactory.register('distilbert', SlotFillingExtractor)  # Alias
    except ImportError as e:
        logging.warning(f"Could not register SlotFillingExtractor: {e}")

# Initialize on module load
_register_implementations()
```

## Configuration Options

### Model Type
- `slot-filling`: Default token-classification based extractor
- `distilbert`: Alias for slot-filling

### Device Options
- `cpu`: CPU-only inference (slower but always available)
- `cuda`: GPU-accelerated inference (requires CUDA-enabled PyTorch)

### Aggregation Strategies
- `simple`: Simple token grouping (default)
- `first`: Take first token score
- `average`: Average token scores
- `max`: Maximum token score

## Integration with Pipeline

```python
# Complete OR-SST pipeline
from stt import STTFactory
from extractor import NERFactory, NERConfig

# 1. Speech-to-Text
stt = STTFactory.create('whisper', 'base')
audio_data = load_audio('recording.wav')
transcript = stt.transcribe(audio_data)

# 2. Entity Extraction
config = NERConfig(confidence_threshold=0.6)
ner = NERFactory.create('slot-filling', config)
entities = ner.extract(transcript)

# 3. Structured Output
# entities is already in ORFormJSON-compatible format
```

## Best Practices

1. **Always validate** configuration before creating expensive model instances
2. **Use factory pattern** instead of instantiating classes directly
3. **Check availability** before attempting extraction
4. **Handle None returns** from factory methods gracefully
5. **Reuse instances** when processing multiple transcripts with same config
6. **Set confidence threshold** based on your precision/recall requirements

## Comparison with STT Module

| Feature | STT Module | NER Module |
|---------|------------|------------|
| Base Class | `BaseSTT` | `BaseNER` |
| Configuration | Constructor parameters | `NERConfig` dataclass |
| Factory Method | `create(type, model_name, device, compute_type)` | `create(type, config)` |
| Validation | `validate_model(type, model_name, device, compute_type)` | `validate_model(type, config)` |
| Auto-registration | Yes | Yes |
| Output Format | String (transcript) | Dict (structured entities) |

## Troubleshooting

### Model Not Found
```
Error: NER model slot-filling is not available
```
**Solution:** Ensure `models/slot_model/` exists with required files:
- `config.json`
- `model.safetensors`
- `tokenizer.json`
- `vocab.txt`

### CUDA Warnings
```
Warning: CUDA device specified but CUDA is not available
```
**Solution:** Install PyTorch with CUDA support or use `device='cpu'`

### Import Errors
```
ImportError: cannot import name 'BaseNER'
```
**Solution:** Ensure `extractor/base_ner.py` exists and is properly formatted

## Future Extensions

Planned NER implementations:
- SpaCy-based NER
- BERT-large token classifier
- Custom CRF models
- Ensemble methods

## See Also

- [STT_MODEL_SYSTEM.md](../STT_MODEL_SYSTEM.md) - Similar architecture for STT
- [NER_USAGE_EXAMPLES.py](NER_USAGE_EXAMPLES.py) - Code examples
- [schema.py](schema.py) - Output schema definitions
