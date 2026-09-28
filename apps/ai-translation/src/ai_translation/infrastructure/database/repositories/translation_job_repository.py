from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ai_translation.infrastructure.database.models import TranslationJob
from ai_translation.infrastructure.database.schemas import (
    TranslationJobCreate,
    TranslationJobUpdate,
)
from ai_translation.infrastructure.database.repositories.base_repository import (
    BaseRepository,
)


class TranslationJobRepository(BaseRepository[TranslationJob, TranslationJobCreate, TranslationJobUpdate]):
    """Repository for TranslationJob operations."""

    def __init__(self, session: AsyncSession):
        super().__init__(session, TranslationJob)

    async def get_by_job_id(self, job_id: str) -> Optional[TranslationJob]:
        """Get a job by its job_id."""
        query = select(self.model).where(self.model.job_id == job_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_by_status(
        self,
        status: str,
        skip: int = 0,
        limit: int = 100,
    ) -> List[TranslationJob]:
        """Get jobs filtered by status."""
        query = (
            select(self.model)
            .where(self.model.status == status)
            .order_by(self.model.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_pending_jobs(
        self,
        limit: int = 100,
    ) -> List[TranslationJob]:
        """Get all pending jobs."""
        return await self.get_by_status("pending", limit=limit)

    async def get_processing_jobs(
        self,
        limit: int = 100,
    ) -> List[TranslationJob]:
        """Get all processing jobs."""
        return await self.get_by_status("processing", limit=limit)
