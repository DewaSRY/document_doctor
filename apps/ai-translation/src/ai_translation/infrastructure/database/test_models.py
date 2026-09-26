"""Basic tests for database models and repositories."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from ai_translation.infrastructure.database.models import Base, TranslationRecord, TranslationJob
from ai_translation.infrastructure.database.schemas import (
    TranslationRecordCreate,
    TranslationJobCreate,
)
from ai_translation.infrastructure.database.repositories import (
    TranslationRecordRepository,
    TranslationJobRepository,
)


@pytest.fixture
async def async_session():
    """Create an in-memory SQLite database for testing."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    AsyncSessionLocal = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with AsyncSessionLocal() as session:
        yield session

    await engine.dispose()


@pytest.mark.asyncio
async def test_create_translation_record(async_session: AsyncSession):
    """Test creating a translation record."""
    repo = TranslationRecordRepository(async_session)

    record_in = TranslationRecordCreate(
        source_text="Hello",
        translated_text="Halo",
        source_language="en",
        target_language="id",
        model_name="Qwen/Qwen2.5-7B",
    )

    record = await repo.create(record_in)
    await async_session.flush()

    assert record.id is not None
    assert record.source_text == "Hello"
    assert record.translated_text == "Halo"
    assert record.source_language == "en"
    assert record.target_language == "id"


@pytest.mark.asyncio
async def test_get_by_languages(async_session: AsyncSession):
    """Test filtering records by languages."""
    repo = TranslationRecordRepository(async_session)

    # Create multiple records
    for i in range(3):
        record_in = TranslationRecordCreate(
            source_text=f"Text {i}",
            translated_text=f"Teks {i}",
            source_language="en",
            target_language="id",
            model_name="Qwen/Qwen2.5-7B",
        )
        await repo.create(record_in)

    await async_session.flush()

    # Query by languages
    records = await repo.get_by_languages("en", "id")
    assert len(records) == 3


@pytest.mark.asyncio
async def test_create_translation_job(async_session: AsyncSession):
    """Test creating a translation job."""
    repo = TranslationJobRepository(async_session)

    job_in = TranslationJobCreate(
        job_id="test_job_001",
        total_records=100,
    )

    job = await repo.create(job_in)
    await async_session.flush()

    assert job.id is not None
    assert job.job_id == "test_job_001"
    assert job.status == "pending"
    assert job.total_records == 100


@pytest.mark.asyncio
async def test_get_by_job_id(async_session: AsyncSession):
    """Test retrieving job by job_id."""
    repo = TranslationJobRepository(async_session)

    job_in = TranslationJobCreate(
        job_id="unique_job_123",
        total_records=50,
    )

    await repo.create(job_in)
    await async_session.flush()

    job = await repo.get_by_job_id("unique_job_123")
    assert job is not None
    assert job.job_id == "unique_job_123"
