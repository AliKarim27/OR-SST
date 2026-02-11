"""
Base NER (Named Entity Recognition) interface for OR-SST project.
All NER implementations should inherit from this base class.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Dict, Optional


@dataclass
class NERConfig:
    """
    Configuration for NER model instances.
    
    Attributes:
        model_type: Type identifier (e.g., 'slot-filling', 'distilbert')
        model_dir: Path to model directory or HuggingFace model ID
        device: Device to run on ('cpu', 'cuda')
        aggregation_strategy: Token aggregation strategy ('simple', 'first', 'average', 'max')
        max_length: Maximum sequence length for tokenization (default: 512)
        batch_size: Batch size for inference (default: 1)
        confidence_threshold: Minimum confidence score for entity extraction (default: 0.5)
    """
    model_type: str = "slot-filling"
    model_dir: str = "models/slot_model"
    device: str = "cpu"
    aggregation_strategy: str = "max"
    max_length: int = 512
    batch_size: int = 1
    confidence_threshold: float = 0.5
    
    def to_dict(self) -> Dict[str, any]:
        """Convert configuration to dictionary."""
        return {
            'model_type': self.model_type,
            'model_dir': self.model_dir,
            'device': self.device,
            'aggregation_strategy': self.aggregation_strategy,
            'max_length': self.max_length,
            'batch_size': self.batch_size,
            'confidence_threshold': self.confidence_threshold,
        }
    
    @classmethod
    def from_dict(cls, config_dict: Dict[str, any]) -> 'NERConfig':
        """Create configuration from dictionary."""
        return cls(**config_dict)


class BaseNER(ABC):
    """Abstract base class for Named Entity Recognition models"""
    
    def __init__(self, config: NERConfig):
        """
        Initialize NER model with configuration.
        
        Args:
            config: NERConfig instance with model configuration
        """
        self.config = config
        self.model = None
        self.tokenizer = None
    
    @abstractmethod
    def extract(self, transcript: str) -> dict:
        """
        Extract named entities from transcript text.
        
        Args:
            transcript: Input text string to extract entities from
        
        Returns:
            Dictionary with extracted structured entities
        """
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """
        Check if this NER implementation is available (dependencies installed, model loaded).
        
        Returns:
            True if the model can be used, False otherwise
        """
        pass
    
    @abstractmethod
    def get_model_info(self) -> Dict[str, str]:
        """
        Get information about this NER model.
        
        Returns:
            Dictionary with model information and metadata
        """
        pass
    
    def preprocess(self, text: str) -> str:
        """
        Optional preprocessing step for input text.
        Default implementation returns text unchanged.
        
        Args:
            text: Raw input text
        
        Returns:
            Preprocessed text
        """
        return text
    
    def postprocess(self, entities: list, original_text: str) -> dict:
        """
        Optional postprocessing step for extracted entities.
        Default implementation returns entities unchanged.
        
        Args:
            entities: Raw extracted entities from model
            original_text: Original input text
        
        Returns:
            Postprocessed structured data
        """
        return entities
    
    def get_config(self) -> NERConfig:
        """
        Get current configuration.
        
        Returns:
            NERConfig instance
        """
        return self.config
