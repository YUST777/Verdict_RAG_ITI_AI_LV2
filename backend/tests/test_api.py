from fastapi.testclient import TestClient
from app.main import app
from app.services.known_solutions import known_answer

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


def test_watermelon_is_deterministic():
    answer = known_answer("4-A", "Watermelon", "cpp")
    assert answer is not None
    assert "w > 2 && w % 2 == 0" in answer
    assert "min_cut" not in answer


def test_watermelon_query_skips_generic_retrieval(monkeypatch):
    class ExplodingRetriever:
        def search(self, *args, **kwargs):
            raise AssertionError("known problems must not use generic retrieval")

    monkeypatch.setattr(app.state, "retriever", ExplodingRetriever())
    response = TestClient(app).post("/api/query", json={
        "question": "solve it",
        "problem_id": "4-A",
        "problem_statement": "Watermelon",
        "language": "cpp",
        "mode": "full",
    })
    assert response.status_code == 200
    body = response.json()
    assert body["verified"] is True
    assert body["model"] == "deterministic"
    assert body["citations"] == []
