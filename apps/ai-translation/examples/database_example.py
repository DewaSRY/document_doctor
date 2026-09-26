"""
Example usage of the database layer with async operations.

Run this with: python -m examples.database_example
"""

import asyncio
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from ai_translation.infrastructure.database.models import Base
from ai_translation.infrastructure.database.schemas import (
    TranslationRecordCreate,
    TranslationRecordResponse,
    TranslationJobCreate,
    TranslationJobUpdate,
)
from ai_translation.infrastructure.database.repositories import (
    TranslationRecordRepository,
    TranslationJobRepository,
)


async def setup_test_db():
    """Create in-memory SQLite database for testing."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    AsyncSessionLocal = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    return AsyncSessionLocal, engine


async def example_translation_records(session: AsyncSession):
    """Example: Create and retrieve translation records."""
    print("\n=== Translation Records Example ===")

    repo = TranslationRecordRepository(session)

    # Create records
    records_data = [
        {
            "source_text": "Good morning",
            "translated_text": "Selamat pagi",
            "source_language": "en",
            "target_language": "id",
            "emotion_tags": "formal,polite",
            "model_name": "Qwen/Qwen2.5-7B",
        },
        {
            "source_text": "How are you?",
            "translated_text": "Apa kabar?",
            "source_language": "en",
            "target_language": "id",
            "emotion_tags": "casual",
            "model_name": "Qwen/Qwen2.5-7B",
        },
        {
            "source_text": "Thank you",
            "translated_text": "Terima kasih",
            "source_language": "en",
            "target_language": "id",
            "emotion_tags": "formal",
            "model_name": "Qwen/Qwen2.5-7B",
        },
    ]

    print("Creating translation records...")
    for data in records_data:
        record_in = TranslationRecordCreate(**data)
        record = await repo.create(record_in)
        await session.flush()
        print(f"  ✓ Created: {data['source_text']} -> {data['translated_text']}")

    await session.commit()

    # Retrieve all records
    all_records = await repo.get_all(limit=10)
    print(f"\nTotal records: {len(all_records)}")

    # Filter by languages
    print("\nRecords (English to Indonesian):")
    en_to_id = await repo.get_by_languages("en", "id")
    for record in en_to_id:
        response = TranslationRecordResponse.model_validate(record)
        print(f"  • {response.source_text} → {response.translated_text}")

    # Search
    print("\nSearching for 'good':")
    results = await repo.search_by_source_text("good")
    for record in results:
        print(f"  • {record.source_text}")


async def example_translation_jobs(session: AsyncSession):
    """Example: Create and track translation jobs."""
    print("\n=== Translation Jobs Example ===")

    repo = TranslationJobRepository(session)

    # Create a job
    print("Creating translation job...")
    job_in = TranslationJobCreate(
        job_id="batch_translation_001",
        total_records=100,
    )
    job = await repo.create(job_in)
    await session.flush()
    print(f"  ✓ Created job: {job.job_id}")
    print(f"    Status: {job.status}")
    print(f"    Total records: {job.total_records}")

    # Start processing
    print("\nStarting job processing...")
    update1 = TranslationJobUpdate(
        status="processing",
        started_at=datetime.utcnow(),
    )
    job = await repo.update(job.id, update1)
    await session.flush()
    print(f"  ✓ Status updated: {job.status}")

    # Simulate progress
    print("\nUpdating progress...")
    for i, progress in enumerate([25, 50, 75], 1):
        update = TranslationJobUpdate(
            processed_records=progress,
        )
        job = await repo.update(job.id, update)
        await session.flush()
        print(f"  ✓ Progress: {progress}% complete")

    # Complete job
    print("\nCompleting job...")
    update_final = TranslationJobUpdate(
        status="completed",
        processed_records=100,
        completed_at=datetime.utcnow(),
    )
    job = await repo.update(job.id, update_final)
    await session.commit()
    print(f"  ✓ Job completed!")
    print(f"    Status: {job.status}")
    print(f"    Processed: {job.processed_records}/{job.total_records}")

    # Query jobs
    print("\nQuerying completed jobs...")
    completed = await repo.get_by_status("completed")
    for job in completed:
        print(f"  • {job.job_id}: {job.processed_records}/{job.total_records} records")


async def example_pagination(session: AsyncSession):
    """Example: Pagination and counting."""
    print("\n=== Pagination Example ===")

    repo = TranslationRecordRepository(session)

    # Get count
    total = await repo.count()
    print(f"Total records in database: {total}")

    # Paginate
    page_size = 2
    pages = (total + page_size - 1) // page_size

    print(f"\nPaginating with page size {page_size}:")
    for page in range(pages):
        skip = page * page_size
        records = await repo.get_all(skip=skip, limit=page_size)
        print(f"  Page {page + 1}: {len(records)} records")
        for record in records:
            print(f"    • {record.source_text}")


async def main():
    """Run all examples."""
    print("🚀 Database Layer Examples")
    print("=" * 50)

    # Setup test database
    AsyncSessionLocal, engine = await setup_test_db()

    async with AsyncSessionLocal() as session:
        # Run examples
        await example_translation_records(session)
        await example_translation_jobs(session)
        await example_pagination(session)

    # Cleanup
    await engine.dispose()

    print("\n" + "=" * 50)
    print("✅ All examples completed successfully!")


if __name__ == "__main__":
    asyncio.run(main())
