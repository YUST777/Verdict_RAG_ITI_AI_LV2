"""Ingest PDFs and text/JSON files into Chroma.

Usage: python -m scripts.ingest --input ../data --persist-dir ./data/chroma
"""
import argparse, asyncio, hashlib, json, re
from pathlib import Path
from app.core.config import Settings
from app.services.retrieval import Retriever
from app.services.database import HistoryStore

def extract(path: Path) -> str:
    if path.suffix.lower() == ".pdf":
        from pypdf import PdfReader
        return "\n".join(page.extract_text() or "" for page in PdfReader(str(path)).pages)
    if path.suffix.lower() == ".json":
        return json.dumps(json.loads(path.read_text(encoding="utf-8")), ensure_ascii=False, indent=2)
    return path.read_text(encoding="utf-8", errors="ignore")

def chunks(text: str, size: int = 1200, overlap: int = 160):
    clean = re.sub(r"\s+", " ", text).strip()
    return [clean[i:i + size] for i in range(0, len(clean), max(1, size - overlap)) if clean[i:i + size].strip()]

def main():
    parser = argparse.ArgumentParser(); parser.add_argument("--input", required=True); parser.add_argument("--persist-dir", default=None); parser.add_argument("--collection", default=None)
    args = parser.parse_args(); defaults = Settings(); settings = Settings(chroma_persist_dir=args.persist_dir or defaults.chroma_persist_dir, chroma_collection=args.collection or defaults.chroma_collection)
    retriever = Retriever(settings.chroma_persist_dir, settings.chroma_collection, settings.embedding_model)
    docs, ids, metas = [], [], []
    for path in sorted(Path(args.input).rglob("*")):
        if path.suffix.lower() not in {".pdf", ".txt", ".md", ".json"}: continue
        for index, chunk in enumerate(chunks(extract(path))):
            source = hashlib.sha1(f"{path}:{index}".encode()).hexdigest()
            docs.append(chunk); ids.append(source); metas.append({"source_id": source, "title": path.stem, "source": str(path), "path": str(path), "chunk": index})
    indexed = retriever.add(docs, ids, metas)
    if settings.database_url:
        asyncio.run(HistoryStore(settings).record_documents(metas))
    print(f"Indexed {indexed} chunks into {settings.chroma_persist_dir}")

if __name__ == "__main__": main()
