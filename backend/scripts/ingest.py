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

def source_url(path: Path, text: str) -> str | None:
    """Read an optional public source URL embedded in a corpus document."""
    match = re.search(r"(?mi)^Source:\s*(https?://\S+)\s*$", text)
    return match.group(1) if match else None

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
        full_text = extract(path)
        public_url = source_url(path, full_text)
        for index, chunk in enumerate(chunks(full_text)):
            source = hashlib.sha1(f"{path}:{index}".encode()).hexdigest()
            metadata = {"source_id": source, "title": path.stem, "source": str(path), "path": str(path), "chunk": index}
            if public_url:
                metadata["source_url"] = public_url
            docs.append(chunk); ids.append(source); metas.append(metadata)
    indexed = retriever.add(docs, ids, metas)
    if settings.database_url:
        asyncio.run(HistoryStore(settings).record_documents(metas))
    print(f"Indexed {indexed} chunks into {settings.chroma_persist_dir}")

if __name__ == "__main__": main()
