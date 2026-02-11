"""
Correction Manager - Merge and manage correction files for model retraining.
Combines corrections from interactive testing with existing training data.
"""
import json
import logging
from pathlib import Path
from typing import List, Dict, Optional, Set
from datetime import datetime
import shutil


class CorrectionManager:
    """
    Manages correction data for NER model retraining.
    Helps merge, deduplicate, and organize corrections from interactive testing.
    """
    
    def __init__(self, data_dir: str = 'data/labels', backup: bool = True):
        """
        Initialize the correction manager.
        
        Args:
            data_dir: Directory containing training data files
            backup: Whether to backup existing files before merging (default: True)
        """
        self.logger = logging.getLogger(__name__)
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.backup = backup
    
    def load_jsonl_file(self, filepath: Path) -> List[Dict]:
        """
        Load a JSONL file containing token-tag pairs.
        
        Args:
            filepath: Path to JSONL file
        
        Returns:
            List of dictionaries with 'tokens' and 'tags' keys
        """
        records = []
        try:
            with open(filepath, 'r') as f:
                for idx, line in enumerate(f):
                    try:
                        record = json.loads(line.strip())
                        if 'tokens' in record and 'tags' in record:
                            records.append(record)
                    except json.JSONDecodeError as e:
                        self.logger.warning(f"Could not parse line {idx} in {filepath}: {str(e)}")
            
            self.logger.info(f"Loaded {len(records)} records from {filepath}")
            return records
        
        except Exception as e:
            self.logger.error(f"Failed to load {filepath}: {str(e)}")
            return []
    
    def save_jsonl_file(self, filepath: Path, records: List[Dict]):
        """
        Save records to a JSONL file.
        
        Args:
            filepath: Path to save to
            records: List of dictionaries with 'tokens' and 'tags' keys
        """
        try:
            filepath.parent.mkdir(parents=True, exist_ok=True)
            with open(filepath, 'w') as f:
                for record in records:
                    f.write(json.dumps(record) + '\n')
            
            self.logger.info(f"Saved {len(records)} records to {filepath}")
            return True
        
        except Exception as e:
            self.logger.error(f"Failed to save {filepath}: {str(e)}")
            return False
    
    def get_record_signature(self, record: Dict) -> str:
        """
        Create a unique signature for a record to detect duplicates.
        
        Args:
            record: Record with 'tokens' and 'tags'
        
        Returns:
            Hash-like string signature
        """
        tokens_str = ' '.join(record.get('tokens', []))
        return tokens_str  # Simple signature: space-joined tokens
    
    def merge_corrections(self, 
                         correction_file: str = 'data/labels/corrections.jsonl',
                         output_file: str = 'data/labels/train_corrected.jsonl',
                         deduplicate: bool = True) -> bool:
        """
        Merge corrections with existing training data.
        
        Args:
            correction_file: Path to corrections file from interactive testing
            output_file: Path to save merged training data
            deduplicate: Remove duplicate records (default: True)
        
        Returns:
            True if successful, False otherwise
        """
        correction_path = self.data_dir / correction_file if not Path(correction_file).is_absolute() else Path(correction_file)
        output_path = self.data_dir / output_file if not Path(output_file).is_absolute() else Path(output_file)
        
        # Load corrections
        if not correction_path.exists():
            self.logger.error(f"Correction file not found: {correction_path}")
            return False
        
        corrections = self.load_jsonl_file(correction_path)
        if not corrections:
            self.logger.warning("No corrections loaded")
            return False
        
        # Load existing training data
        train_path = self.data_dir / 'train.jsonl'
        existing_train = self.load_jsonl_file(train_path) if train_path.exists() else []
        
        # Combine
        merged = existing_train + corrections
        
        # Deduplicate if requested
        if deduplicate:
            merged = self._deduplicate_records(merged)
        
        # Backup original if requested
        if self.backup and output_path.exists():
            backup_path = output_path.with_suffix('.jsonl.backup')
            shutil.copy(output_path, backup_path)
            self.logger.info(f"Backed up original to {backup_path}")
        
        # Save merged data
        return self.save_jsonl_file(output_path, merged)
    
    def _deduplicate_records(self, records: List[Dict]) -> List[Dict]:
        """
        Remove duplicate records based on token sequence.
        
        Args:
            records: List of records
        
        Returns:
            Deduplicated list of records
        """
        seen: Set[str] = set()
        deduplicated = []
        
        for record in records:
            sig = self.get_record_signature(record)
            if sig not in seen:
                seen.add(sig)
                deduplicated.append(record)
        
        self.logger.info(f"Deduplicated {len(records)} records to {len(deduplicated)} unique records")
        return deduplicated
    
    def analyze_corrections(self, correction_file: str = 'data/labels/corrections.jsonl') -> Dict:
        """
        Analyze correction patterns to identify common model mistakes.
        
        Args:
            correction_file: Path to corrections file
        
        Returns:
            Dictionary with analysis results
        """
        correction_path = self.data_dir / correction_file if not Path(correction_file).is_absolute() else Path(correction_file)
        
        if not correction_path.exists():
            self.logger.error(f"Correction file not found: {correction_path}")
            return {}
        
        corrections = self.load_jsonl_file(correction_path)
        
        # Count corrections if metadata available
        total_corrections = len(corrections)
        correctors = set()
        
        # Analyze tag patterns
        tag_frequencies: Dict[str, int] = {}
        
        for record in corrections:
            for tag in record.get('tags', []):
                tag_frequencies[tag] = tag_frequencies.get(tag, 0) + 1
            
            if 'metadata' in record and 'corrected_by' in record['metadata']:
                correctors.add(record['metadata']['corrected_by'])
        
        analysis = {
            'total_correction_records': total_corrections,
            'unique_correctors': list(correctors),
            'tag_frequencies': tag_frequencies,
            'most_common_tags': sorted(tag_frequencies.items(), key=lambda x: x[1], reverse=True)[:5]
        }
        
        return analysis
    
    def validate_corrections(self, correction_file: str = 'data/labels/corrections.jsonl') -> Dict:
        """
        Validate correction file for consistency.
        
        Args:
            correction_file: Path to corrections file
        
        Returns:
            Dictionary with validation results
        """
        correction_path = self.data_dir / correction_file if not Path(correction_file).is_absolute() else Path(correction_file)
        
        issues = []
        stats = {
            'total_records': 0,
            'valid_records': 0,
            'issues': issues
        }
        
        if not correction_path.exists():
            issues.append(f"File not found: {correction_path}")
            return stats
        
        records = self.load_jsonl_file(correction_path)
        stats['total_records'] = len(records)
        
        # Load valid labels
        try:
            label_map_path = Path('data/label_map.json')
            with open(label_map_path, 'r') as f:
                valid_labels = set(json.load(f))
        except Exception as e:
            self.logger.warning(f"Could not load label_map.json: {str(e)}")
            valid_labels = {'O'}
        
        for idx, record in enumerate(records):
            tokens = record.get('tokens', [])
            tags = record.get('tags', [])
            
            # Check if tokens and tags match in length
            if len(tokens) != len(tags):
                issues.append({
                    'record_idx': idx,
                    'issue': 'Token-tag mismatch',
                    'tokens': len(tokens),
                    'tags': len(tags)
                })
                continue
            
            # Check if all tags are valid
            invalid_tags = [tag for tag in tags if tag not in valid_labels]
            if invalid_tags:
                issues.append({
                    'record_idx': idx,
                    'issue': 'Invalid tags',
                    'invalid_tags': list(set(invalid_tags))
                })
                continue
            
            stats['valid_records'] += 1
        
        return stats
    
    def export_corrections_report(self, correction_file: str = 'data/labels/corrections.jsonl',
                                  output_file: str = 'corrections_report.json') -> bool:
        """
        Export a detailed report of corrections.
        
        Args:
            correction_file: Path to corrections file
            output_file: Path to save report
        
        Returns:
            True if successful, False otherwise
        """
        analysis = self.analyze_corrections(correction_file)
        validation = self.validate_corrections(correction_file)
        
        report = {
            'generated_at': datetime.now().isoformat(),
            'correction_file': str(correction_file),
            'analysis': analysis,
            'validation': validation
        }
        
        try:
            output_path = Path(output_file)
            with open(output_path, 'w') as f:
                json.dump(report, f, indent=2)
            
            self.logger.info(f"Saved report to {output_path}")
            return True
        
        except Exception as e:
            self.logger.error(f"Failed to save report: {str(e)}")
            return False


def main():
    """
    Example usage of Correction Manager.
    """
    logging.basicConfig(
        level=logging.INFO,
        format='[%(name)s] %(levelname)s: %(message)s'
    )
    
    manager = CorrectionManager()
    
    # Validate corrections
    print("\n=== VALIDATING CORRECTIONS ===")
    validation = manager.validate_corrections()
    print(f"Valid records: {validation['valid_records']}/{validation['total_records']}")
    if validation['issues']:
        print(f"Issues found: {len(validation['issues'])}")
        for issue in validation['issues'][:5]:  # Show first 5
            print(f"  {issue}")
    
    # Analyze corrections
    print("\n=== ANALYZING CORRECTIONS ===")
    analysis = manager.analyze_corrections()
    print(f"Total correction records: {analysis['total_correction_records']}")
    print(f"Unique correctors: {analysis['unique_correctors']}")
    print(f"Most common tags: {analysis['most_common_tags']}")
    
    # Export report
    print("\n=== EXPORTING REPORT ===")
    manager.export_corrections_report()
    
    # Merge corrections
    print("\n=== MERGING CORRECTIONS ===")
    if manager.merge_corrections():
        print("Corrections merged successfully!")
        print("Next step: Run training script with train_corrected.jsonl")


if __name__ == '__main__':
    main()
