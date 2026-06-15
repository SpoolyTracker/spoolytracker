from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)
HEADERS = {"x-workspace-id": "1", "x-user-id": "7", "x-plan": "pro"}


def test_capture_returns_captured_memory():
    r = client.post(
        "/chat",
        json={"message": "souviens-toi que mon seuil minimum de PLA noir est 2kg"},
        headers=HEADERS,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["intent"] == "memory_saved"
    assert body["data"]["captured_memory"]["content"]


def test_chat_uses_snapshot_memories():
    snapshot = {
        "organization_id": "1", "user_id": "7",
        "settings": {"organization_id": "1", "plan": "pro", "low_stock_threshold": 20, "low_stock_threshold_type": "PERCENTAGE"},
        "filaments": [], "consumptions": [], "projects": [],
        "memories": [{"type": "preference", "content": "garder 200g de PLA Matte", "tags": ["pla"]}],
    }
    r = client.post(
        "/chat",
        json={"message": "quel est mon stock ?", "snapshot": snapshot},
        headers=HEADERS,
    )
    assert r.status_code == 200
    assert r.json()["data"].get("memories") == snapshot["memories"]
