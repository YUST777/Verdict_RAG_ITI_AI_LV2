from fastapi.testclient import TestClient
from app.main import app

def test_health():
    client = TestClient(app)
    # Ensure real or compliant retriever for health check
    if not hasattr(app.state.retriever, "ready"):
        class HealthRetriever:
            ready = True
            def count(self): return 1
        app.state.retriever = HealthRetriever()

    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "document_count" in body

def test_query_happy_path(monkeypatch):
    class FakeRetriever:
        ready = True
        def count(self): return 1
        def search(self, *args, **kwargs):
            return [{
                "id": "s1",
                "document": "In competitive programming, standard input and output in C++ is handled using <iostream>.",
                "metadata": {"title": "cpp_basics_io", "source": "cpp_basics_io.md", "source_url": "https://codeforces.com/blog/entry/73285", "chunk": 0},
                "score": 0.95
            }]

    class FakeGenerator:
        async def generate(self, *args, **kwargs):
            return "Read string with `cin >> s;` and output `cout << \"Hello, \" << s;`."

    monkeypatch.setattr(app.state, "retriever", FakeRetriever())
    monkeypatch.setattr(app.state, "generator", FakeGenerator())

    client = TestClient(app)
    response = client.post("/api/query", json={
        "question": "How to read string and print Hello in C++?",
        "problem_statement": "Given a name S. Print Hello, (name).",
        "mode": "teach"
    })
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "sources" in data
    assert len(data["citations"]) == 1
    assert data["citations"][0]["id"] == "s1"
    assert data["grounded"] is True

def test_query_invalid_input_422():
    client = TestClient(app)
    # Question is required and must have min_length=1
    response = client.post("/api/query", json={"question": ""})
    assert response.status_code == 422

    # Invalid mode (must match allowed modes enum)
    response = client.post("/api/query", json={"question": "valid question", "mode": "unsupported_mode"})
    assert response.status_code == 422
