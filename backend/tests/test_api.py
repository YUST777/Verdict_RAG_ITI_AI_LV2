from fastapi.testclient import TestClient
from app.main import app

def test_root_and_health():
    client = TestClient(app)
    assert client.get("/").status_code == 200
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "document_count" in body

def test_query_contract(monkeypatch):
    class FakeRetriever:
        def search(self, *args, **kwargs): return [{"id": "s1", "document": "Binary search note", "metadata": {"title": "Binary search", "source": "notes.md", "chunk": 0}, "score": 0.9}]
    class FakeGenerator:
        async def generate(self, *args, **kwargs): return "Use binary search [1]."
    app.state.retriever, app.state.generator = FakeRetriever(), FakeGenerator()
    response = TestClient(app).post("/api/query", json={"question": "How?", "mode": "hint"})
    assert response.status_code == 200
    assert response.json()["citations"][0]["id"] == "s1"
