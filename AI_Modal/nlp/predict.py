"""Try the trained model interactively.

Run (from the AI_Modal project root):
    python nlp/predict.py                      # interactive
    python nlp/predict.py "3 bed house for rent in DHA Phase 5 under 150k"
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from nlp.nlp_parser import analyze, load  # noqa: E402


def show(text):
    result = analyze(text)
    if result is None:
        print("model not available - train it first: python nlp/train_spacy.py")
        return
    print(f"  intent     : {result['intent']}  (confidence {result['confidence']})")
    for span in result["spans"]:
        print(f"  {span['label']:13s}: {span['text']}")


if __name__ == "__main__":
    load()
    if len(sys.argv) > 1:
        show(" ".join(sys.argv[1:]))
        sys.exit(0)
    print("Type a sentence (empty line to quit)")
    while True:
        q = input("> ").strip()
        if not q:
            break
        show(q)
