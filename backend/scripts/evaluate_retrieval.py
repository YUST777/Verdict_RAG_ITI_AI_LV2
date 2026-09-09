"""Report Hit@k against the hand-labeled evaluation/questions.json set.

Run after ingestion: python -m scripts.evaluate_retrieval --persist-dir data/chroma
"""
import argparse, json
from pathlib import Path
from app.core.config import Settings
from app.services.retrieval import Retriever

def main():
    parser = argparse.ArgumentParser(); parser.add_argument("--questions", default="evaluation/questions.json"); parser.add_argument("--persist-dir", default=None); parser.add_argument("--k", type=int, default=3)
    args = parser.parse_args(); defaults = Settings(); retriever = Retriever(args.persist_dir or defaults.chroma_persist_dir, defaults.chroma_collection, defaults.embedding_model)
    rows = json.loads(Path(args.questions).read_text(encoding="utf-8")); attempted = hits = 0
    for row in rows:
        expected = row.get("expected_source")
        results = retriever.search(row["question"], args.k)
        titles = " ".join(x["metadata"].get("title", "").lower().replace("_", " ") for x in results)
        hit = bool(expected and expected.replace("_", " ") in titles)
        if expected: attempted += 1; hits += int(hit)
        print(f"{row['id']}: {'hit' if hit else 'miss'} ({', '.join(x['metadata'].get('title', 'untitled') for x in results) or 'no results'})")
    print(f"Hit@{args.k}: {hits}/{attempted} ({hits / attempted:.1%})" if attempted else "No labeled in-domain questions")

if __name__ == "__main__": main()
