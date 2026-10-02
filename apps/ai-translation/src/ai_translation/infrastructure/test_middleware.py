from fastapi import FastAPI
from fastapi.testclient import TestClient

from ai_translation.config import settings
from ai_translation.infrastructure.middleware import setup_portal_api_auth


def make_auth_test_app() -> FastAPI:
    app = FastAPI()
    setup_portal_api_auth(app)

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/private")
    async def private() -> dict[str, str]:
        return {"status": "ok"}

    return app


def test_health_does_not_require_portal_token(monkeypatch) -> None:
    monkeypatch.setattr(settings, "portal_api_token", None)
    monkeypatch.setattr(settings, "dev_mode", False)

    response = TestClient(make_auth_test_app()).get("/api/health")

    assert response.status_code == 200


def test_private_route_requires_bearer_token(monkeypatch) -> None:
    monkeypatch.setattr(settings, "portal_api_token", "test-token")
    monkeypatch.setattr(settings, "dev_mode", False)

    response = TestClient(make_auth_test_app()).get("/api/private")

    assert response.status_code == 401
    assert response.json() == {"detail": "Unauthorized"}


def test_private_route_accepts_matching_bearer_token(monkeypatch) -> None:
    monkeypatch.setattr(settings, "portal_api_token", "test-token")
    monkeypatch.setattr(settings, "dev_mode", False)

    response = TestClient(make_auth_test_app()).get(
        "/api/private", headers={"Authorization": "Bearer test-token"}
    )

    assert response.status_code == 200