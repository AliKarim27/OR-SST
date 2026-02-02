import json
import os
from datasets import load_dataset
from transformers import AutoTokenizer, AutoModelForTokenClassification, TrainingArguments, Trainer

def load_labels(path):
    with open(path, "r") as f:
        label_list = json.load(f)
    label2id = {l:i for i,l in enumerate(label_list)}
    id2label = {i:l for l,i in label2id.items()}
    return label_list, label2id, id2label

def create_dev_from_train():
    """Split train.jsonl into train (80%) and dev (20%) if dev doesn't exist."""
    train_path = "data/labels/train.jsonl"
    dev_path = "data/labels/dev.jsonl"
    
    # If dev.jsonl already exists, don't overwrite
    if os.path.exists(dev_path):
        return
    
    # Read all examples from train.jsonl
    examples = []
    with open(train_path, "r") as f:
        for line in f:
            if line.strip():
                examples.append(json.loads(line))
    
    if not examples:
        print("⚠️ No training examples found in train.jsonl")
        return
    
    # Split 80/20
    split_idx = int(len(examples) * 0.8)
    train_examples = examples[:split_idx]
    dev_examples = examples[split_idx:]
    
    # Write back train.jsonl (80%)
    with open(train_path, "w") as f:
        for ex in train_examples:
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")
    
    # Write dev.jsonl (20%)
    with open(dev_path, "w") as f:
        for ex in dev_examples:
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")
    
    print(f"✅ Split data: {len(train_examples)} train, {len(dev_examples)} validation")

def main():
    # Ensure dev.jsonl exists
    create_dev_from_train()
    
    base_model = "distilbert-base-uncased"  # use multilingual if needed
    label_list, label2id, id2label = load_labels("data/label_map.json")

    ds = load_dataset("json", data_files={
        "train": "data/labels/train.jsonl",
        "validation": "data/labels/dev.jsonl"
    })

    tokenizer = AutoTokenizer.from_pretrained(base_model)

    def encode(example):
        tok = tokenizer(
            example["tokens"], 
            is_split_into_words=True, 
            truncation=True,
            max_length=512,
            padding="max_length"
        )
        word_ids = tok.word_ids()
        labels = []
        prev = None
        for w in word_ids:
            if w is None:
                labels.append(-100)
            elif w != prev:
                labels.append(label2id[example["tags"][w]])
            else:
                labels.append(label2id[example["tags"][w]])
            prev = w
        tok["labels"] = labels
        return tok

    ds_tok = ds.map(encode)

    model = AutoModelForTokenClassification.from_pretrained(
        base_model,
        num_labels=len(label_list),
        id2label=id2label,
        label2id=label2id
    )

    args = TrainingArguments(
        output_dir="models/slot_model",
        learning_rate=2e-5,
        per_device_train_batch_size=8,
        per_device_eval_batch_size=8,
        num_train_epochs=5,
        weight_decay=0.01,
        eval_strategy="epoch",
        save_strategy="epoch"
    )

    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=ds_tok["train"],
        eval_dataset=ds_tok["validation"]
    )

    trainer.train()
    trainer.save_model("models/slot_model")
    tokenizer.save_pretrained("models/slot_model")
    print("✅ Saved trained model to models/slot_model")

if __name__ == "__main__":
    main()
