from .health import router as health_router
from .translation import router as translation_router
from .documents import router as documents_router

__all__ = ["health_router", "translation_router", "documents_router"]
