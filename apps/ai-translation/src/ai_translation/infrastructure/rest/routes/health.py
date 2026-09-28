from fastapi import APIRouter

from ai_translation.infrastructure.rest.response_normalizer import normalize_success_response

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> dict:
    """Check if the service is healthy and running."""
    return normalize_success_response(
        data={"status": "ok"},
        message="Service is healthy",
        code=200,
    )
