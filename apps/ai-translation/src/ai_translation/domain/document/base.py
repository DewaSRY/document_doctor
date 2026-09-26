from abc import ABC, abstractmethod


class DocumentHandler(ABC):
    """Abstract base class for document handlers."""

    @abstractmethod
    async def extract_text(self, file_content: bytes) -> dict[str, list[str]]:
        """Extract text from document, preserving structure info."""
        pass

    @abstractmethod
    async def create_translated_document(
        self,
        file_content: bytes,
        translations: dict[str, str],
        source_language: str,
        target_language: str,
    ) -> bytes:
        """Create translated document preserving original structure."""
        pass
