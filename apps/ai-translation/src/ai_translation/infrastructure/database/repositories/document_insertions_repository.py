from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ai_translation.infrastructure.database.models import DocumentInsertions, DocumentMedia


class DocumentInsertionsRepository:
    """Repository for the blocks added to a document in the editor, and their images."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_blocks(self, document_id: str) -> list[dict]:
        """The inserted blocks of a document, in order; none when it has not been given any."""
        stored = await self._get(document_id)
        return stored.blocks if stored else []

    async def set_blocks(self, document_id: str, blocks: list[dict]) -> None:
        stored = await self._get(document_id)
        if stored is None:
            self.session.add(DocumentInsertions(document_id=document_id, blocks=blocks))
        else:
            # Reassign rather than mutate so SQLAlchemy sees the JSON change.
            stored.blocks = blocks

    async def add_media(self, document_id: str, name: str, content_type: str, data: bytes) -> None:
        self.session.add(DocumentMedia(document_id=document_id, name=name, content_type=content_type, data=data))

    async def get_media(self, document_id: str, name: str) -> Optional[DocumentMedia]:
        query = select(DocumentMedia).where(DocumentMedia.document_id == document_id, DocumentMedia.name == name)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_media_data(self, document_id: str, names: set[str]) -> dict[str, bytes]:
        """The uploaded images with these names, by name."""
        if not names:
            return {}
        query = select(DocumentMedia.name, DocumentMedia.data).where(
            DocumentMedia.document_id == document_id, DocumentMedia.name.in_(names)
        )
        result = await self.session.execute(query)
        return {name: data for name, data in result.all()}

    async def _get(self, document_id: str) -> Optional[DocumentInsertions]:
        query = select(DocumentInsertions).where(DocumentInsertions.document_id == document_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
