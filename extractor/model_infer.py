"""
Slot Filling Extractor - Named Entity Recognition model for OR-SST project.
Inherits from BaseNER to provide token-level entity extraction from medical transcripts.
"""
import logging
from typing import Dict, Optional
from transformers import AutoTokenizer, AutoModelForTokenClassification, pipeline

from .base_ner import BaseNER, NERConfig
from .postprocess import decode_entities_to_json


class SlotFillingExtractor(BaseNER):
    """
    Slot Filling Extractor for Named Entity Recognition.
    
    Uses a fine-tuned DistilBERT token classification model to extract entities
    from operating room transcripts and convert them to structured ORFormJSON format.
    """
    
    def __init__(self, config: NERConfig):
        """
        Initialize the Slot Filling Extractor with configuration.
        
        Args:
            config: NERConfig instance with model configuration
                   (model_dir, aggregation_strategy, device, etc.)
        """
        super().__init__(config)
        self.logger = logging.getLogger(__name__)
        self.pipe = None
        
        try:
            self.tokenizer = AutoTokenizer.from_pretrained(config.model_dir)
            self.model = AutoModelForTokenClassification.from_pretrained(config.model_dir)
            self.pipe = pipeline(
                "token-classification",
                model=self.model,
                tokenizer=self.tokenizer,
                aggregation_strategy=config.aggregation_strategy,
                device=0 if config.device == "cuda" else -1  # -1 for CPU
            )
            self.logger.info(f"SlotFillingExtractor initialized with model from {config.model_dir}")
        except Exception as e:
            self.logger.error(f"Failed to initialize SlotFillingExtractor: {str(e)}")
            self.pipe = None
    
    def extract(self, transcript: str) -> dict:
        """
        Extract entities from transcript and return structured OR form data.
        
        Args:
            transcript: Input text string from medical transcription
        
        Returns:
            Dictionary with extracted structured entities (ORFormJSON compatible)
        """
        if not self.is_available():
            self.logger.warning("Extractor not available, returning empty extraction")
            return {}
        
        try:
            entities = self.pipe(transcript)
            return decode_entities_to_json(entities, transcript)
        except Exception as e:
            self.logger.error(f"Error during extraction: {str(e)}")
            return {}
    
    def is_available(self) -> bool:
        """
        Check if the extractor is available and ready to use.
        
        Returns:
            True if model is loaded and pipeline is available
        """
        return self.pipe is not None and self.model is not None and self.tokenizer is not None
    
    def get_model_info(self) -> Dict[str, str]:
        """
        Get information about the loaded model.
        
        Returns:
            Dictionary with model metadata
        """
        if not self.is_available():
            return {"status": "not_available"}
        
        return {
            "status": "available",
            "model_type": self.config.model_type,
            "model_dir": self.config.model_dir,
            "aggregation_strategy": self.config.aggregation_strategy,
            "device": self.config.device,
            "max_length": str(self.config.max_length),
            "batch_size": str(self.config.batch_size)
        }
