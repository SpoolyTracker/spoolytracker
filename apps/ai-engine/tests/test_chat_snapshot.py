from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)

SNAPSHOT = {
    "organization_id": "1",
    "user_id": "7",
    "settings": {"organization_id": "1", "plan": "free", "low_stock_threshold": 20, "low_stock_threshold_type": "PERCENTAGE"},
    "filaments": [
        {
            "id": "12", "organization_id": "1", "name": "PLA Noir", "brand_name": "BambuLab",
            "material_name": "PLA", "color_name": "Noir", "color_hex": "#000000",
            "weight_initial_g": 1000, "weight_remaining_g": 500,
        }
    ],
    "consumptions": [],
    "projects": [],
}


def test_chat_uses_pushed_snapshot_as_data_source():
    response = client.post(
        "/chat",
        json={"message": "quel est mon stock ?", "snapshot": SNAPSHOT},
        headers={"x-workspace-id": "1", "x-user-id": "7", "x-plan": "free"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["source"] == "main_api"


def test_chat_without_snapshot_still_responds():
    response = client.post(
        "/chat",
        json={"message": "quel est mon stock ?"},
        headers={"x-workspace-id": "1", "x-user-id": "7", "x-plan": "free"},
    )
    assert response.status_code == 200
    assert "answer" in response.json()


def test_chat_pro_forecast_uses_pushed_snapshot():
    response = client.post(
        "/chat",
        json={"message": "donne moi la date de rupture estimee", "snapshot": SNAPSHOT},
        headers={"x-workspace-id": "1", "x-user-id": "7", "x-plan": "pro"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["source"] == "main_api"
