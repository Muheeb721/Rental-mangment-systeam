"""
Evaluate the trained model on data it never saw during training.

Run (from the AI_Modal project root):   python nlp/evaluate.py

Reports
  * Intent accuracy + per-intent precision / recall / F1 + confusion matrix
  * Per-entity precision / recall / F1 (exact span + label match)
on two sets:
  1. data/splits/test.jsonl         held-out 10% of the generated dataset (written by train_spacy.py)
  2. data/handwritten_eval.jsonl    sentences written by hand, NOT produced by the generator
                                    (a harder, more realistic check)
Saves models/metrics.json and models/confusion_matrix.csv.
"""
import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import spacy

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "models" / "rental_nlp_model"
TEST = ROOT / "data" / "splits" / "test.jsonl"
HANDWRITTEN = ROOT / "data" / "handwritten_eval.jsonl"
METRICS = ROOT / "models" / "metrics.json"
CONFUSION_CSV = ROOT / "models" / "confusion_matrix.csv"


def load_rows(path):
    rows = []
    for line in open(path, encoding="utf-8"):
        if not line.strip():
            continue
        r = json.loads(line)
        ents = []
        for e in r.get("entities", []):
            if isinstance(e[0], int):              # [start, end, label]
                ents.append((e[0], e[1], e[2]))
            else:                                   # ["entity text", label] -> find offsets
                start = r["text"].find(e[0])
                if start < 0:
                    raise ValueError(f"'{e[0]}' not found in: {r['text']}")
                ents.append((start, start + len(e[0]), e[1]))
        rows.append({"text": r["text"], "intent": r["intent"], "entities": ents})
    return rows


def prf(tp, fp, fn):
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    f = 2 * p * r / (p + r) if p + r else 0.0
    return round(p, 4), round(r, 4), round(f, 4)


def evaluate(nlp, rows):
    labels = sorted(set(nlp.get_pipe("textcat").labels))
    gold_i, pred_i = [], []
    ent_counts = {}            # label -> [tp, fp, fn]
    errors = []
    docs = nlp.pipe([r["text"] for r in rows], batch_size=128)
    for r, doc in zip(rows, docs):
        pred = max(doc.cats, key=doc.cats.get)
        gold_i.append(r["intent"])
        pred_i.append(pred)
        gold = {(s, e, l) for s, e, l in r["entities"]}
        found = {(ent.start_char, ent.end_char, ent.label_) for ent in doc.ents}
        for s, e, l in found | gold:
            c = ent_counts.setdefault(l, [0, 0, 0])
            if (s, e, l) in gold and (s, e, l) in found:
                c[0] += 1
            elif (s, e, l) in found:
                c[1] += 1
            else:
                c[2] += 1
        if pred != r["intent"] and len(errors) < 25:
            errors.append({"text": r["text"], "gold": r["intent"], "predicted": pred,
                           "confidence": round(doc.cats[pred], 3)})

    correct = sum(g == p for g, p in zip(gold_i, pred_i))
    accuracy = correct / len(rows) if rows else 0.0
    present = [l for l in labels if l in gold_i or l in pred_i]
    per_intent = {}
    for l in present:
        tp = sum(g == l and p == l for g, p in zip(gold_i, pred_i))
        fp = sum(g != l and p == l for g, p in zip(gold_i, pred_i))
        fn = sum(g == l and p != l for g, p in zip(gold_i, pred_i))
        p_, r_, f_ = prf(tp, fp, fn)
        per_intent[l] = {"precision": p_, "recall": r_, "f1": f_, "support": tp + fn}
    matrix = [[sum(g == a and p == b for g, p in zip(gold_i, pred_i)) for b in present] for a in present]

    per_entity = {}
    TP = FP = FN = 0
    for l, (tp, fp, fn) in sorted(ent_counts.items()):
        p_, r_, f_ = prf(tp, fp, fn)
        per_entity[l] = {"precision": p_, "recall": r_, "f1": f_, "support": tp + fn}
        TP, FP, FN = TP + tp, FP + fp, FN + fn
    ep, er, ef = prf(TP, FP, FN)
    macro_f1 = round(sum(v["f1"] for v in per_intent.values()) / max(1, len(per_intent)), 4)
    return {
        "n_sentences": len(rows),
        "intent_accuracy": round(accuracy, 4),
        "intent_macro_f1": macro_f1,
        "per_intent": per_intent,
        "confusion_matrix": {"labels": present, "matrix": matrix},
        "entity_micro": {"precision": ep, "recall": er, "f1": ef},
        "per_entity": per_entity,
        "sample_errors": errors,
    }


def print_report(name, m):
    print("=" * 78)
    print(f"{name}  ({m['n_sentences']} sentences)")
    print("=" * 78)
    print(f"Intent accuracy : {m['intent_accuracy'] * 100:.2f}%   (macro F1 {m['intent_macro_f1']:.4f})")
    e = m["entity_micro"]
    print(f"Entities (micro): P {e['precision']:.4f}  R {e['recall']:.4f}  F1 {e['f1']:.4f}\n")
    print(f"{'intent':24s} {'prec':>6s} {'recall':>6s} {'f1':>6s} {'n':>5s}")
    for l, v in m["per_intent"].items():
        print(f"{l:24s} {v['precision']:6.3f} {v['recall']:6.3f} {v['f1']:6.3f} {v['support']:5d}")
    print(f"\n{'entity':24s} {'prec':>6s} {'recall':>6s} {'f1':>6s} {'n':>5s}")
    for l, v in m["per_entity"].items():
        print(f"{l:24s} {v['precision']:6.3f} {v['recall']:6.3f} {v['f1']:6.3f} {v['support']:5d}")
    labels, matrix = m["confusion_matrix"]["labels"], m["confusion_matrix"]["matrix"]
    short = [l[:6] for l in labels]
    print("\nConfusion matrix (rows = true intent, columns = predicted)")
    print(" " * 22 + " ".join(f"{s:>6s}" for s in short))
    for l, row in zip(labels, matrix):
        print(f"{l[:21]:21s} " + " ".join(f"{v:6d}" for v in row))
    if m["sample_errors"]:
        print("\nSome mistakes:")
        for err in m["sample_errors"][:8]:
            print(f"  [{err['gold']} -> {err['predicted']} {err['confidence']}] {err['text']}")
    print()


def main():
    if not MODEL_DIR.exists():
        sys.exit(f"Model not found at {MODEL_DIR}. Run: python nlp/train_spacy.py")
    if not TEST.exists():
        sys.exit(f"Test split not found at {TEST}. Run: python nlp/train_spacy.py")
    nlp = spacy.load(MODEL_DIR)
    results = {"model": str(MODEL_DIR.relative_to(ROOT)),
               "evaluated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
               "pipeline": nlp.pipe_names,
               "intents": list(nlp.get_pipe("textcat").labels),
               "entity_labels": list(nlp.get_pipe("ner").labels)}
    test = evaluate(nlp, load_rows(TEST))
    print_report("HELD-OUT TEST SPLIT (generated data, never used for training)", test)
    results["test_split"] = test
    if HANDWRITTEN.exists():
        hand = evaluate(nlp, load_rows(HANDWRITTEN))
        print_report("HAND-WRITTEN EVAL SET (real-style questions, not from the generator)", hand)
        results["handwritten"] = hand

    METRICS.write_text(json.dumps(results, indent=2), encoding="utf-8")
    with open(CONFUSION_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        labels = test["confusion_matrix"]["labels"]
        w.writerow(["true \\ predicted", *labels])
        for l, row in zip(labels, test["confusion_matrix"]["matrix"]):
            w.writerow([l, *row])
    print(f"Saved {METRICS.relative_to(ROOT)} and {CONFUSION_CSV.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
