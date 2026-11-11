"""
Train our own NLP model (intent classification + named-entity recognition) with spaCy v3.

Run (from the AI_Modal project root):
    python nlp/generate_dataset.py      # (re)make data/training_data_labeled.jsonl
    python nlp/train_spacy.py           # train + save models/rental_nlp_model
    python nlp/evaluate.py              # metrics on the held-out test split

What it does
  1. Splits the labelled data 80 / 10 / 10 into train / dev / test (fixed seed) and
     writes them to data/splits/ so evaluation always uses sentences the model never saw.
  2. Builds a blank multi-language spaCy pipeline with two trainable components:
        textcat  -> one intent per sentence (search_property, travel_cost, greeting ...)
        ner      -> entities (AREA, PROPERTY_TYPE, BUDGET, BEDROOMS, PURPOSE, ...)
  3. Trains for EPOCHS passes, evaluates on dev after every epoch and keeps the best model.

Env overrides: EPOCHS (default 15), NLP_MODEL_OUT (output folder)
"""
import json
import os
import random
import time
from pathlib import Path

import spacy
from spacy.training import Example, offsets_to_biluo_tags
from spacy.util import compounding, minibatch

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "training_data_labeled.jsonl"
SPLITS = ROOT / "data" / "splits"
OUT_DIR = Path(os.getenv("NLP_MODEL_OUT") or ROOT / "models" / "rental_nlp_model")
EPOCHS = int(os.getenv("EPOCHS", "15"))
DROPOUT = 0.2
SEED = 42


def split_rows(rows):
    """Stratified 80/10/10 split so every intent appears in every split."""
    rng = random.Random(SEED)
    by_intent = {}
    for r in rows:
        by_intent.setdefault(r["intent"], []).append(r)
    train, dev, test = [], [], []
    for intent in sorted(by_intent):
        items = by_intent[intent]
        rng.shuffle(items)
        n = len(items)
        n_test = max(1, round(n * 0.10))
        n_dev = max(1, round(n * 0.10))
        test += items[:n_test]
        dev += items[n_test:n_test + n_dev]
        train += items[n_test + n_dev:]
    for part in (train, dev, test):
        rng.shuffle(part)
    return train, dev, test


def write_jsonl(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def main():
    random.seed(SEED)
    spacy.util.fix_random_seed(SEED)
    rows = [json.loads(line) for line in open(DATA, encoding="utf-8") if line.strip()]
    train_rows, dev_rows, test_rows = split_rows(rows)
    write_jsonl(SPLITS / "train.jsonl", train_rows)
    write_jsonl(SPLITS / "dev.jsonl", dev_rows)
    write_jsonl(SPLITS / "test.jsonl", test_rows)
    print(f"{len(rows)} sentences -> train={len(train_rows)} dev={len(dev_rows)} test={len(test_rows)}")

    intents = sorted({r["intent"] for r in rows})
    ent_labels = sorted({e[2] for r in rows for e in r["entities"]})
    print(f"intents ({len(intents)}): {', '.join(intents)}")
    print(f"entities ({len(ent_labels)}): {', '.join(ent_labels)}")

    nlp = spacy.blank("xx")             # multi-language tokenizer: English + Roman Urdu
    ner = nlp.add_pipe("ner")
    textcat = nlp.add_pipe("textcat")   # exclusive classes: one intent per sentence
    for label in ent_labels:
        ner.add_label(label)
    for intent in intents:
        textcat.add_label(intent)

    def make_example(r):
        doc = nlp.make_doc(r["text"])
        ents = [tuple(e) for e in r["entities"]]
        if "-" in offsets_to_biluo_tags(doc, ents):   # span not on token boundaries
            return None
        cats = {i: float(i == r["intent"]) for i in intents}
        return Example.from_dict(doc, {"entities": ents, "cats": cats})

    train = [ex for ex in map(make_example, train_rows) if ex is not None]
    dev = [ex for ex in map(make_example, dev_rows) if ex is not None]
    print(f"usable examples: train={len(train)} dev={len(dev)} "
          f"(dropped {len(train_rows) + len(dev_rows) - len(train) - len(dev)} with misaligned spans)")

    optimizer = nlp.initialize(lambda: train)
    best, best_epoch = -1.0, 0
    OUT_DIR.parent.mkdir(parents=True, exist_ok=True)
    history = []
    for epoch in range(1, EPOCHS + 1):
        t0 = time.time()
        random.shuffle(train)
        losses = {}
        for batch in minibatch(train, size=compounding(8.0, 64.0, 1.001)):
            nlp.update(batch, sgd=optimizer, drop=DROPOUT, losses=losses)
        scores = nlp.evaluate(dev)
        intent_acc = scores.get("cats_micro_f", 0.0)  # exclusive cats: micro F == accuracy
        ent_f = scores.get("ents_f") or 0.0
        combined = (intent_acc + ent_f) / 2
        history.append({"epoch": epoch, "ner_loss": round(float(losses.get("ner", 0)), 2),
                        "textcat_loss": round(float(losses.get("textcat", 0)), 4),
                        "dev_intent_acc": round(float(intent_acc), 4), "dev_entity_f1": round(float(ent_f), 4)})
        marker = ""
        if combined > best:
            best, best_epoch = combined, epoch
            nlp.to_disk(OUT_DIR)
            marker = "  * saved"
        print(f"epoch {epoch:2d} | ner_loss {losses.get('ner', 0):8.2f} | "
              f"textcat_loss {losses.get('textcat', 0):7.4f} | dev intent acc {intent_acc:.4f} | "
              f"dev entity F1 {ent_f:.4f} | {time.time() - t0:5.1f}s{marker}")

    write_jsonl(OUT_DIR.parent / "training_history.jsonl", history)
    print(f"\nBest epoch {best_epoch} (dev score {best:.4f}); model saved to {OUT_DIR}")
    print("Next: python nlp/evaluate.py")


if __name__ == "__main__":
    main()
