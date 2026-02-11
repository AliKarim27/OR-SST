"""
Interactive NER Tester - Test NER extraction and save corrections for retraining.
Allows users to review extracted entities, correct any errors, and save the corrected
data back to JSONL format for model retraining.
"""
import json
import logging
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from datetime import datetime

from .ner_factory import NERFactory
from .base_ner import NERConfig


class NERInteractiveTester:
    """
    Interactive tester for NER model that supports user corrections and data collection
    for retraining.
    """
    
    def __init__(self, config: NERConfig, correction_output_path: Optional[str] = None):
        """
        Initialize the interactive NER tester.
        
        Args:
            config: NERConfig instance with model configuration
            correction_output_path: Path to save corrected training data (default: data/labels/corrections.jsonl)
        """
        self.logger = logging.getLogger(__name__)
        self.ner = NERFactory.create(config.model_type, config)
        
        if self.ner is None:
            self.logger.error("Failed to initialize NER model")
            self.ner = None
        
        # Default correction file path
        if correction_output_path is None:
            correction_output_path = "data/labels/corrections.jsonl"
        
        self.correction_output_path = Path(correction_output_path)
        self.correction_output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Track corrections for this session
        self.corrections: List[Dict] = []
        self.logger.info(f"NER Tester initialized. Corrections will be saved to {correction_output_path}")
    
    def tokenize_text(self, text: str) -> List[str]:
        """
        Simple tokenization by splitting on whitespace.
        
        Args:
            text: Text to tokenize
        
        Returns:
            List of tokens
        """
        return text.split()
    
    def extract_and_display(self, transcript: str) -> Tuple[List[str], List[str], Dict]:
        """
        Extract entities and display results for user review.
        
        Args:
            transcript: Input text to extract entities from
        
        Returns:
            Tuple of (tokens, predicted_tags, raw_extraction)
        """
        if self.ner is None or not self.ner.is_available():
            print("ERROR: NER model is not available")
            return [], [], {}
        
        # Tokenize input
        tokens = self.tokenize_text(transcript)
        
        # Get raw model predictions
        raw_predictions = self._get_raw_predictions(transcript)
        
        # Extract entities (structured)
        raw_extraction = self.ner.extract(transcript)
        
        # Convert raw predictions to BIO tags aligned with tokens
        predicted_tags = self._align_predictions_to_tokens(tokens, raw_predictions)
        
        # Display results
        self._display_extraction(tokens, predicted_tags)
        
        return tokens, predicted_tags, raw_extraction
    
    def _get_raw_predictions(self, transcript: str) -> List[Dict]:
        """
        Get raw token-level predictions directly from the model pipeline.
        
        Args:
            transcript: Input text
        
        Returns:
            List of raw prediction dictionaries from HuggingFace pipeline
        """
        try:
            # Access the pipeline directly from the SlotFillingExtractor
            if hasattr(self.ner, 'pipe') and self.ner.pipe is not None:
                return self.ner.pipe(transcript)
            return []
        except Exception as e:
            self.logger.error(f"Error getting raw predictions: {str(e)}")
            return []
    
    def _align_predictions_to_tokens(self, tokens: List[str], raw_predictions: List[Dict]) -> List[str]:
        """
        Align raw HuggingFace predictions to tokens, creating BIO tag sequence.
        
        Args:
            tokens: List of tokens from simple whitespace split
            raw_predictions: List of raw predictions from HuggingFace pipeline
        
        Returns:
            List of BIO tags aligned with tokens
        """
        # Initialize all tags as 'O' (outside)
        tags = ['O'] * len(tokens)
        
        if not raw_predictions:
            return tags
        
        # Build a position map for tokens in the original text
        text = ' '.join(tokens)
        token_positions = []
        pos = 0
        
        for token in tokens:
            start = text.find(token, pos)
            if start == -1:
                # Token not found, use approximation
                token_positions.append((pos, pos + len(token)))
            else:
                end = start + len(token)
                token_positions.append((start, end))
                pos = end
        
        # Match predictions to tokens
        for pred in raw_predictions:
            pred_start = pred.get('start', 0)
            pred_end = pred.get('end', 0)
            entity_tag = pred.get('entity', 'O').upper()
            
            # Remove subword markers
            if entity_tag.startswith('B-'):
                tag = entity_tag
            elif entity_tag.startswith('I-'):
                tag = entity_tag
            else:
                tag = 'O'
            
            # Find which token(s) this prediction overlaps with
            for token_idx, (token_start, token_end) in enumerate(token_positions):
                # Check if prediction overlaps with this token
                if pred_start < token_end and pred_end > token_start:
                    if token_idx == 0 or tags[token_idx] == 'O':
                        # Assign or update tag
                        tags[token_idx] = tag
                    elif tag.startswith('B-') and tag[2:] != tags[token_idx][2:]:
                        # Different entity type, use this one
                        tags[token_idx] = tag
        
        return tags
    
    def _display_extraction(self, tokens: List[str], tags: List[str]):
        """
        Display tokens and tags in a user-friendly format.
        
        Args:
            tokens: List of tokens
            tags: List of predicted BIO tags
        """
        print("\n" + "=" * 100)
        print("EXTRACTION RESULTS - Review and correct if needed")
        print("=" * 100)
        
        # Display in tabular format
        print(f"{'Index':<8} {'Token':<30} {'Predicted Tag':<30}")
        print("-" * 100)
        
        for idx, (token, tag) in enumerate(zip(tokens, tags)):
            # Highlight non-O tags
            tag_display = f">>> {tag} <<<" if tag != 'O' else tag
            print(f"{idx:<8} {token:<30} {tag_display:<30}")
        
        print("=" * 100)
        print(f"Total tokens: {len(tokens)}")
        print(f"Entities found: {sum(1 for tag in tags if tag != 'O')}")
        print("=" * 100)
    
    def collect_corrections(self, tokens: List[str], predicted_tags: List[str]) -> List[str]:
        """
        Interactively collect user corrections for incorrect tags.
        
        Args:
            tokens: List of tokens
            predicted_tags: List of predicted BIO tags
        
        Returns:
            List of corrected BIO tags
        """
        corrected_tags = predicted_tags.copy()
        corrections_made = []
        
        print("\nManually correct any tags that are wrong.")
        print("Enter corrections as: index:NEW_TAG (e.g., '2:B-DATE' or '2:O')")
        print("Type 'done' when finished, 'skip' to keep predictions, 'list' to see available tags\n")
        
        # Load available tags from label_map
        available_tags = self._load_available_tags()
        
        while True:
            user_input = input("Enter correction (or 'done'/'skip'/'list'): ").strip()
            
            if user_input.lower() == 'done':
                break
            elif user_input.lower() == 'skip':
                print("Skipping corrections...")
                return predicted_tags
            elif user_input.lower() == 'list':
                print("\nAvailable tags:")
                for tag in available_tags:
                    print(f"  {tag}")
                print()
                continue
            
            # Parse correction
            try:
                if ':' not in user_input:
                    print("Invalid format. Use 'index:TAG'")
                    continue
                
                idx_str, new_tag = user_input.split(':', 1)
                idx = int(idx_str)
                
                if idx < 0 or idx >= len(tokens):
                    print(f"Index out of range. Valid range: 0-{len(tokens)-1}")
                    continue
                
                if new_tag not in available_tags and new_tag != 'O':
                    print(f"Invalid tag: {new_tag}")
                    continue
                
                old_tag = corrected_tags[idx]
                corrected_tags[idx] = new_tag
                corrections_made.append({
                    'index': idx,
                    'token': tokens[idx],
                    'old_tag': old_tag,
                    'new_tag': new_tag
                })
                
                print(f"✓ Updated token {idx} ('{tokens[idx]}') from {old_tag} to {new_tag}")
            
            except ValueError:
                print("Invalid format. Use 'index:TAG' (e.g., '2:B-DATE')")
            except Exception as e:
                print(f"Error: {str(e)}")
        
        # Display summary of corrections
        if corrections_made:
            print(f"\nTotal corrections made: {len(corrections_made)}")
            for corr in corrections_made:
                print(f"  [{corr['index']}] '{corr['token']}': {corr['old_tag']} → {corr['new_tag']}")
        
        return corrected_tags
    
    def _load_available_tags(self) -> List[str]:
        """
        Load available BIO tags from label_map.json.
        
        Returns:
            List of available tags
        """
        try:
            label_map_path = Path('data/label_map.json')
            with open(label_map_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            self.logger.warning(f"Could not load label_map.json: {str(e)}")
            return ['O']
    
    def save_correction(self, tokens: List[str], corrected_tags: List[str], metadata: Optional[Dict] = None) -> bool:
        """
        Save corrected tokens and tags to JSONL file for retraining.
        
        Args:
            tokens: List of tokens
            corrected_tags: List of corrected BIO tags
            metadata: Optional metadata about this correction (source, timestamp, etc.)
        
        Returns:
            True if save successful, False otherwise
        """
        # Validate input
        if not tokens or not corrected_tags:
            print("ERROR: Empty tokens or tags")
            return False
        
        if len(tokens) != len(corrected_tags):
            print(f"ERROR: Token and tag count mismatch ({len(tokens)} tokens vs {len(corrected_tags)} tags)")
            return False
        
        # Validate tags against label map
        valid_tags = self._load_available_tags()
        invalid_tags = [tag for tag in corrected_tags if tag not in valid_tags]
        
        if invalid_tags:
            print(f"WARNING: Found invalid tags: {set(invalid_tags)}")
            confirm = input("Continue anyway? (yes/no): ").strip().lower()
            if confirm != 'yes':
                return False
        
        # Create JSONL record
        record = {
            "tokens": tokens,
            "tags": corrected_tags
        }
        
        # Add metadata if provided
        if metadata:
            record["metadata"] = metadata
        
        try:
            # Append to corrections file
            with open(self.correction_output_path, 'a') as f:
                f.write(json.dumps(record) + '\n')
            
            self.logger.info(f"Saved correction to {self.correction_output_path}")
            print(f"✓ Correction saved successfully!")
            print(f"  File: {self.correction_output_path}")
            print(f"  Tokens: {len(tokens)}")
            print(f"  Entities: {sum(1 for tag in corrected_tags if tag != 'O')}")
            return True
        
        except Exception as e:
            self.logger.error(f"Failed to save correction: {str(e)}")
            print(f"✗ Error saving correction: {str(e)}")
            return False
    
    def test_and_correct(self, transcript: str, user_name: Optional[str] = None) -> bool:
        """
        Complete workflow: extract, display, correct, and save.
        
        Args:
            transcript: Input text to test
            user_name: Optional username for metadata
        
        Returns:
            True if correction was saved, False otherwise
        """
        print(f"\n{'='*80}")
        print(f"Testing NER on transcript:")
        print(f"{'='*80}")
        print(transcript)
        
        # Step 1: Extract
        tokens, predicted_tags, extraction = self.extract_and_display(transcript)
        
        if not tokens:
            print("Failed to extract entities")
            return False
        
        # Step 2: Collect corrections
        corrected_tags = self.collect_corrections(tokens, predicted_tags)
        
        # Step 3: Ask if user wants to save
        print("\nSave these corrections for retraining?")
        confirm = input("Enter 'yes' to save, anything else to skip: ").strip().lower()
        
        if confirm != 'yes':
            print("Skipped saving")
            return False
        
        # Step 4: Save with metadata
        metadata = {
            'corrected_at': datetime.now().isoformat(),
            'corrected_by': user_name or 'unknown',
            'session': 'interactive_testing'
        }
        
        return self.save_correction(tokens, corrected_tags, metadata)
    
    def interactive_session(self, user_name: Optional[str] = None):
        """
        Start an interactive testing session where user can test multiple transcripts.
        
        Args:
            user_name: Optional username for metadata
        """
        print("\n" + "=" * 100)
        print("NER INTERACTIVE TESTER - Model Correction & Retraining Data Collection")
        print("=" * 100)
        
        if self.ner and self.ner.is_available():
            info = self.ner.get_model_info()
            print(f"Model: {info.get('model_type', 'unknown')} from {info.get('model_dir', 'unknown')}")
            print(f"Device: {info.get('device', 'unknown')}")
        else:
            print("WARNING: NER model not loaded properly")
        
        print(f"Corrections will be saved to: {self.correction_output_path}")
        print("=" * 100)
        print("\nUSAGE INSTRUCTIONS:")
        print("1. Enter a transcript (you can paste multi-line text)")
        print("2. Review extracted entities")
        print("3. Correct any wrong tags using format: 'index:TAG' (e.g., '2:B-DATE')")
        print("4. Type 'list' to see available tags")
        print("5. Type 'done' when finished correcting")
        print("6. Confirm to save the corrected data")
        print("=" * 100)
        
        total_saved = 0
        
        try:
            while True:
                print("\n" + "-" * 100)
                print("Enter transcript (paste multi-line, then press Enter twice):")
                print("(or type 'quit' to exit)")
                print("-" * 100)
                
                # Allow multi-line input
                lines = []
                empty_count = 0
                
                while True:
                    try:
                        line = input()
                    except EOFError:
                        # Handle piped input
                        break
                    
                    if line.strip().lower() == 'quit':
                        lines = None
                        break
                    
                    if not line.strip():
                        empty_count += 1
                        if empty_count >= 1 and lines:
                            # Two consecutive empty lines = end of input
                            break
                    else:
                        empty_count = 0
                        lines.append(line)
                
                if lines is None or not lines:
                    break
                
                transcript = ' '.join(lines).strip()
                
                if self.test_and_correct(transcript, user_name):
                    total_saved += 1
        
        except KeyboardInterrupt:
            print("\n\nSession interrupted by user (Ctrl+C)")
        
        finally:
            print(f"\n{'='*100}")
            print(f"Session ended.")
            print(f"Total corrections saved: {total_saved}")
            print(f"Corrections file: {self.correction_output_path}")
            print(f"\nNext steps:")
            print(f"1. Review corrections using: python -m extractor.correction_manager")
            print(f"2. Merge with training data for retraining")
            print(f"{'='*100}\n")


def main():
    """
    Example usage of NER Interactive Tester.
    """
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='[%(name)s] %(levelname)s: %(message)s'
    )
    
    # Create NER configuration
    config = NERConfig(
        model_type='slot-filling',
        model_dir='models/slot_model',
        device='cpu'
    )
    
    # Initialize tester
    tester = NERInteractiveTester(config)
    
    # Start interactive session
    tester.interactive_session(user_name="test_user")


if __name__ == '__main__':
    main()
