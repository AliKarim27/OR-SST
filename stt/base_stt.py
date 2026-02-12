"""
Base STT (Speech-to-Text) interface for OR-SST project.
All STT implementations should inherit from this base class.
"""
from abc import ABC, abstractmethod
import numpy as np
import re
import string


def postprocess_for_ner(text: str) -> str:
    """
    Post-process STT output to match DistilBERT NER model input format.
    
    The NER model (distilbert-base-uncased) was trained on:
    - Lowercase text
    - No punctuation
    - Normalized whitespace
    
    Args:
        text: Raw transcription text from STT model
    
    Returns:
        Cleaned text suitable for NER model input
    """
    if not text:
        return ""
    
    result = text
    
    # Step 1: Convert to lowercase (distilbert-base-uncased expects lowercase)
    result = result.lower()
    
    # Step 2: Remove punctuation (training data has no punctuation)
    # Keep hyphens within words (e.g., "intra-op"), remove standalone punctuation
    result = re.sub(r'[^\w\s\-]', ' ', result)
    
    # Step 3: Clean up hyphen edge cases (remove leading/trailing hyphens)
    result = re.sub(r'(^|\s)-+|-+(\s|$)', r'\1\2', result)
    
    # Step 4: Normalize whitespace (collapse multiple spaces to single space)
    result = re.sub(r'\s+', ' ', result)
    
    # Step 5: Strip leading/trailing whitespace
    result = result.strip()
    
    return result

class BaseSTT(ABC):
    """Abstract base class for Speech-to-Text models"""
    
    def __init__(self, model_name: str, device: str = "cpu", compute_type: str = "int8"):
        self.model_name = model_name
        self.device = device
        self.compute_type = compute_type
        self.model = None
    
    @abstractmethod
    def preprocess(self, audio_tuple):
        """
        Preprocess audio for transcription.
        
        Args:
            audio_tuple: Tuple of (sample_rate, audio_data)
        
        Returns:
            Preprocessed audio ready for transcription
        """
        pass
    
    @abstractmethod
    def transcribe(self, audio_data: np.ndarray, language: str = "en", postprocess: bool = True) -> str:
        """
        Transcribe audio to text.
        
        Args:
            audio_data: Preprocessed audio data
            language: Language code (default: "en")
            postprocess: If True, applies post-processing for NER model input
                        (lowercase, remove punctuation, normalize whitespace)
                        This ensures output is compatible with DistilBERT-based NER.
        
        Returns:
            Transcribed text string
        """
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """
        Check if this STT implementation is available (dependencies installed).
        
        Returns:
            True if the model can be loaded, False otherwise
        """
        pass
    
    def get_info(self) -> dict:
        """
        Get information about this STT model.
        
        Returns:
            Dictionary with model information
        """
        return {
            'model_name': self.model_name,
            'device': self.device,
            'compute_type': self.compute_type,
            'type': self.__class__.__name__,
        }
