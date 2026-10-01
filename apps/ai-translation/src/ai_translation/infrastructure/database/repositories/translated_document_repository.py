from typing import List, Optional
from datetime import datetime, timedelta
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from collections.abc import Sequence

from ai_translation.infrastructure.database.models import TranslatedDocument
from ai_translation.infrastructure.database.schemas import (
    TranslatedDocumentCreate,
    TranslatedDocumentUpdate,
)
from ai_translation.infrastructure.database.repositories.base_repository import (
    BaseRepository,
)


class TranslatedDocumentRepository(
    BaseRepository[TranslatedDocument, TranslatedDocumentCreate, TranslatedDocumentUpdate]
):
    """Repository for TranslatedDocument operations."""

    def __init__(self, session: AsyncSession):
        super().__init__(session, TranslatedDocument)

    async def get_by_document_id(self, document_id: str) -> Optional[TranslatedDocument]:
        """Get document by unique document ID."""
        query = select(self.model).where(self.model.document_id == document_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_by_languages(
        self,
        source_language: str,
        target_language: str,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[TranslatedDocument]:
        """Get documents filtered by source and target languages."""
        query = (
            select(self.model)
            .where(
                and_(
                    self.model.source_language == source_language,
                    self.model.target_language == target_language,
                )
            )
            .order_by(self.model.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_recent(
        self,
        hours: int = 24,
        limit: int = 100,
    ) -> Sequence[TranslatedDocument]:
        """Get documents from the last N hours."""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        query = (
            select(self.model)
            .where(self.model.created_at >= cutoff_time)
            .order_by(self.model.created_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_by_document_type(
        self,
        document_type: str,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[TranslatedDocument]:
        """Get documents filtered by type (pdf or docx)."""
        query = (
            select(self.model)
            .where(self.model.document_type == document_type)
            .order_by(self.model.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_document_content(self, document_id: str) -> Optional[bytes]:
        """Get the translated document binary content."""
        document = await self.get_by_document_id(document_id)
        if document:
            return document.translated_document
        return None
