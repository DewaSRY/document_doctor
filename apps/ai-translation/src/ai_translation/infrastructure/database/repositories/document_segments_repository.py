from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ai_translation.infrastructure.database.models import DocumentSegments


class DocumentSegmentsRepository:
    """Repository for DocumentSegments operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_document_id(self, document_id: str) -> Optional[DocumentSegments]:
        """Get the stored segments of a translated document."""
        query = select(DocumentSegments).where(DocumentSegments.document_id == document_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
