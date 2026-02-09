"""
NER (Named Entity Recognition) module for OR-SST project.
Provides structured entity extraction from operating room transcripts.
"""
import logging

from .base_ner import BaseNER, NERConfig
from .model_infer import SlotFillingExtractor
from .ner_factory import NERFactory
from .schema import ORFormJSON, Medication

# Configure logging
logging.basicConfig(level=logging.INFO)

# Auto-registration happens in ner_factory.py
# No manual registration needed here

# Public API
__all__ = [
    'BaseNER',
    'NERConfig',
    'SlotFillingExtractor',
    'NERFactory',
    'ORFormJSON',
    'Medication'
]
