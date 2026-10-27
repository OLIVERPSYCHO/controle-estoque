import pytest
from fastapi.testclient import TestClient

from estoque import db
from estoque.main import app


@pytest.fixture
def client():
    # Cada teste usa um banco novo em memória
    db.configurar_banco("sqlite://")
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def workspace(client):
    resposta = client.post("/api/workspaces")
    return {"X-Workspace-Id": resposta.json()["id"]}
