from .health import router as health_router
from .translation import router as translation_router
from .documents import router as documents_router
from .document_ai import router as document_ai_router
from .file_tools import router as file_tools_router
from .image_tools import router as image_tools_router

__all__ = [
    "health_router",
    "translation_router",
    "documents_router",
    "document_ai_router",
    "file_tools_router",
    "image_tools_router",
]
