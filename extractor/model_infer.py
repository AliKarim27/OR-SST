from transformers import AutoTokenizer, AutoModelForTokenClassification, pipeline
from extractor.postprocess import decode_entities_to_json

class SlotFillingExtractor:
    def __init__(self, model_dir: str):
        self.tokenizer = AutoTokenizer.from_pretrained(model_dir)
        self.model = AutoModelForTokenClassification.from_pretrained(model_dir)
        self.pipe = pipeline(
            "token-classification",
            model=self.model,
            tokenizer=self.tokenizer,
            aggregation_strategy="simple"
        )

    def extract(self, transcript: str) -> dict:
        entities = self.pipe(transcript)
        return decode_entities_to_json(entities, transcript)
