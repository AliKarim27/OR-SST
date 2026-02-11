"""
Slot Filling Extractor - Named Entity Recognition model for OR-SST project.
Inherits from BaseNER to provide token-level entity extraction from medical transcripts.
"""
import logging
from typing import Dict, List, Optional
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
            self.logger.info(f"Loading tokenizer from {config.model_dir}")
            self.tokenizer = AutoTokenizer.from_pretrained(config.model_dir)
            self.logger.info("Tokenizer loaded successfully")
            
            self.logger.info(f"Loading model from {config.model_dir} with memory optimization")
            # Use low_cpu_mem_usage to reduce memory footprint during loading
            self.model = AutoModelForTokenClassification.from_pretrained(
                config.model_dir,
                low_cpu_mem_usage=True,  # Load weights progressively to reduce memory spikes
                local_files_only=True     # Don't attempt to download, only use local files
            )
            self.logger.info("Model loaded successfully")
            
            self.logger.info(f"Creating pipeline with aggregation_strategy={config.aggregation_strategy}, device={config.device}")
            self.pipe = pipeline(
                "token-classification",
                model=self.model,
                tokenizer=self.tokenizer,
                aggregation_strategy=config.aggregation_strategy,
                device=0 if config.device == "cuda" else -1  # -1 for CPU
            )
            self.logger.info(f"SlotFillingExtractor initialized successfully with model from {config.model_dir}")
        except Exception as e:
            self.logger.error(f"Failed to initialize SlotFillingExtractor: {str(e)}", exc_info=True)
            self.pipe = None
            self.model = None
            self.tokenizer = None
    
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
            raw_entities = self.pipe(transcript)
            # Post-process to merge any remaining subword tokens
            merged_entities = self._merge_subword_tokens(raw_entities, transcript)
            return decode_entities_to_json(merged_entities, transcript)
        except Exception as e:
            self.logger.error(f"Error during extraction: {str(e)}")
            return {}
    
    def _merge_subword_tokens(self, entities: List[Dict], text: str) -> List[Dict]:
        """
        Merge WordPiece subword tokens (##) into complete words.
        This handles cases where aggregation_strategy doesn't fully merge tokens.
        
        Args:
            entities: List of entity dictionaries from pipeline
            text: Original input text
        
        Returns:
            List of merged entity dictionaries
        """
        if not entities:
            return []
        
        merged = []
        buffer = None
        
        for entity in entities:
            word = entity.get('word', '')
            
            # Check if this is a subword continuation token
            is_subword = word.startswith('##')
            
            if is_subword and buffer:
                # Merge with previous token - remove ## prefix
                buffer['word'] += word.replace('##', '')
                buffer['end'] = entity['end']
                # Update score (take maximum confidence)
                buffer['score'] = max(buffer['score'], entity['score'])
            elif not is_subword and buffer:
                # Check if same entity type and adjacent positions
                same_entity = buffer.get('entity') == entity.get('entity') or buffer.get('entity_group') == entity.get('entity_group')
                # Consider adjacent if positions are close (within 2 chars for spaces/punctuation)
                is_adjacent = (entity['start'] - buffer['end']) <= 2
                
                if same_entity and is_adjacent:
                    # Merge adjacent words of same entity type
                    # Include any text between (e.g., spaces, punctuation)
                    between_text = text[buffer['end']:entity['start']]
                    buffer['word'] += between_text + entity['word']
                    buffer['end'] = entity['end']
                    # Average the scores
                    buffer['score'] = (buffer['score'] + entity['score']) / 2
                else:
                    # Different entity or not adjacent - save buffer and start new
                    merged.append(buffer)
                    buffer = entity.copy()
            else:
                # Save previous buffer if exists
                if buffer:
                    merged.append(buffer)
                # Start new buffer
                buffer = entity.copy()
        
        # Don't forget the last buffer
        if buffer:
            merged.append(buffer)
        
        return merged
    
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
