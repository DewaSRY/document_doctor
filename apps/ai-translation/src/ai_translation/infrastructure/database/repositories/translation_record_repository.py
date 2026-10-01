from typing import List, Optional
from datetime import datetime, timedelta
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from collections.abc import Sequence

from ai_translation.infrastructure.database.models import TranslationRecord
from ai_translation.infrastructure.database.schemas import (
    TranslationRecordCreate,
    TranslationRecordUpdate,
)
from ai_translation.infrastructure.database.repositories.base_repository import (
    BaseRepository,
)


class TranslationRecordRepository(BaseRepository[TranslationRecord, TranslationRecordCreate, TranslationRecordUpdate]):
    """Repository for TranslationRecord operations."""

    def __init__(self, session: AsyncSession):
        super().__init__(session, TranslationRecord)

    async def get_by_languages(
        self,
        source_language: str,
        target_language: str,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[TranslationRecord]:
        """Get records filtered by source and target languages."""
        query = (
            select(self.model)
            .where(
                and_(
                    self.model.source_language == source_language,
                    self.model.target_language == target_language,
                )
            )
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_recent(
        self,
        hours: int = 24,
        limit: int = 100,
    ) -> Sequence[TranslationRecord]:
        """Get records from the last N hours."""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        query = (
            select(self.model)
            .where(self.model.created_at >= cutoff_time)
            .order_by(self.model.created_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(query)
        return result.scalars().all()

    async def search_by_source_text(
        self,
        text: str,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[TranslationRecord]:
        """Search records by source text (partial match)."""
        query = (
            select(self.model)
            .where(self.model.source_text.ilike(f"%{text}%"))
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_by_model_name(
        self,
        model_name: str,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[TranslationRecord]:
        """Get records by model name."""
        query = (
            select(self.model)
            .where(self.model.model_name == model_name)
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(query)
        return result.scalars().all()
