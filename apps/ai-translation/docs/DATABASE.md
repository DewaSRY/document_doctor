# Database Layer Documentation

This document describes the database layer implementation using SQLAlchemy 2.0, asyncpg, and Pydantic.

## Overview

The database layer provides:
- **SQLAlchemy 2.0** ORM with async support
- **asyncpg** driver for PostgreSQL
- **Pydantic** models for request/response validation
- **Repository Pattern** for data access layer
- **Connection pooling** with configurable pool size

## Architecture

```
infrastructure/database/
├── __init__.py          # Package exports
├── config.py            # Database configuration
├── session.py           # Async session management
├── models.py            # SQLAlchemy ORM models
├── schemas.py           # Pydantic validation schemas
└── repositories/
    ├── __init__.py
    ├── base_repository.py           # Abstract base repository
    ├── translation_record_repository.py
    └── translation_job_repository.py
```

## Configuration

Database configuration is loaded from environment variables via `pydantic-settings`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=ai_translation
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=0
DB_ECHO=false
DB_ECHO_POOL=false
```

### Configuration Class

```python
from ai_translation.infrastructure.database import get_db_config

config = get_db_config()
print(config.database_url)  # postgresql+asyncpg://...
```

## Models

### TranslationRecord

Stores individual translation operations:

```python
class TranslationRecord(Base):
    id: int                  # Primary key
    source_text: str         # Original text
    translated_text: str     # Translated result
    source_language: str     # Source language code (e.g., 'zh')
    target_language: str     # Target language code (e.g., 'id')
    emotion_tags: str | None # Comma-separated emotion tags
    voice_tags: str | None   # Comma-separated voice tags
    model_name: str          # Model used for translation
    created_at: datetime     # Record creation timestamp
    updated_at: datetime     # Last update timestamp
```

### TranslationJob

Tracks batch translation jobs:

```python
class TranslationJob(Base):
    id: int                  # Primary key
    job_id: str              # Unique job identifier
    status: str              # 'pending', 'processing', 'completed', 'failed'
    total_records: int       # Total records to process
    processed_records: int   # Records successfully processed
    failed_records: int      # Records that failed
    error_message: str | None # Error details if failed
    created_at: datetime     # Job creation timestamp
    started_at: datetime | None  # When processing started
    completed_at: datetime | None # When processing completed
```

## Schemas (Pydantic)

### TranslationRecordCreate

Used when creating new records:

```python
from ai_translation.infrastructure.database.schemas import TranslationRecordCreate

record_in = TranslationRecordCreate(
    source_text="Hello",
    translated_text="Halo",
    source_language="en",
    target_language="id",
    emotion_tags="formal,professional",
    voice_tags="female",
    model_name="Qwen/Qwen2.5-7B",
)
```

### TranslationRecordResponse

Used when returning records:

```python
from ai_translation.infrastructure.database.schemas import TranslationRecordResponse

# Automatically created from database model
record: TranslationRecordResponse = TranslationRecordResponse.model_validate(db_record)
```

## Repositories

The repository pattern provides a data access layer with common CRUD operations.

### BaseRepository

All repositories inherit from `BaseRepository[Model, CreateSchema, UpdateSchema]`:

```python
class BaseRepository(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    async def create(obj_in: CreateSchemaType) -> ModelType
    async def get_by_id(obj_id: int) -> Optional[ModelType]
    async def get_all(skip: int = 0, limit: int = 100) -> List[ModelType]
    async def update(obj_id: int, obj_in: UpdateSchemaType) -> Optional[ModelType]
    async def delete(obj_id: int) -> bool
    async def count() -> int
```

### TranslationRecordRepository

Specialized queries for translation records:

```python
from ai_translation.infrastructure.database.repositories import TranslationRecordRepository

repo = TranslationRecordRepository(session)

# Get by ID
record = await repo.get_by_id(1)

# Get all with pagination
records = await repo.get_all(skip=0, limit=10)

# Search by languages
records = await repo.get_by_languages("en", "id", limit=20)

# Get recent records (last 24 hours)
recent = await repo.get_recent(hours=24)

# Search by text (partial match)
results = await repo.search_by_source_text("hello", limit=10)

# Get records by model
records = await repo.get_by_model_name("Qwen/Qwen2.5-7B")

# Count total
total = await repo.count()
```

### TranslationJobRepository

Specialized queries for translation jobs:

```python
from ai_translation.infrastructure.database.repositories import TranslationJobRepository

repo = TranslationJobRepository(session)

# Get by job ID
job = await repo.get_by_job_id("job_123")

# Get by status
jobs = await repo.get_by_status("processing")

# Get pending jobs
pending = await repo.get_pending_jobs()

# Get processing jobs
processing = await repo.get_processing_jobs()
```

## Usage in FastAPI

### Initialization

The database is automatically initialized via FastAPI's lifespan context manager:

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from ai_translation.infrastructure.database import init_db, close_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()  # Initialize on startup
    yield
    await close_db()  # Cleanup on shutdown

app = FastAPI(lifespan=lifespan)
```

### Dependency Injection

Use `get_db_session` as a dependency to get an async session:

```python
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from ai_translation.infrastructure.database import get_db_session
from ai_translation.infrastructure.database.repositories import TranslationRecordRepository

@app.get("/translations/{record_id}")
async def get_translation(
    record_id: int,
    session: AsyncSession = Depends(get_db_session),
):
    repo = TranslationRecordRepository(session)
    record = await repo.get_by_id(record_id)
    if not record:
        raise HTTPException(status_code=404)
    return record
```

### Transaction Management

Automatically commit changes after successful response:

```python
@app.post("/v1/translate")
async def translate(
    request: TranslateRequest,
    session: AsyncSession = Depends(get_db_session),
):
    try:
        # ... translation logic ...
        
        repo = TranslationRecordRepository(session)
        await repo.create(record_data)
        await session.commit()
        
        return response
    except Exception as exc:
        await session.rollback()
        raise
```

## Examples

### Example 1: Create and retrieve a translation

```python
from ai_translation.infrastructure.database.repositories import TranslationRecordRepository
from ai_translation.infrastructure.database.schemas import TranslationRecordCreate

async def save_translation(session: AsyncSession):
    repo = TranslationRecordRepository(session)
    
    # Create
    record_in = TranslationRecordCreate(
        source_text="Good morning",
        translated_text="Selamat pagi",
        source_language="en",
        target_language="id",
        model_name="Qwen/Qwen2.5-7B",
    )
    record = await repo.create(record_in)
    await session.commit()
    
    # Retrieve
    retrieved = await repo.get_by_id(record.id)
    print(retrieved.translated_text)  # "Selamat pagi"
```

### Example 2: Search and filter

```python
async def search_translations(session: AsyncSession):
    repo = TranslationRecordRepository(session)
    
    # Get recent translations
    recent = await repo.get_recent(hours=1, limit=50)
    
    # Search specific language pair
    en_to_id = await repo.get_by_languages("en", "id", limit=100)
    
    # Text search
    results = await repo.search_by_source_text("good", limit=20)
    
    return {"recent": len(recent), "en_to_id": len(en_to_id), "search": len(results)}
```

### Example 3: Job tracking

```python
from ai_translation.infrastructure.database.repositories import TranslationJobRepository
from ai_translation.infrastructure.database.schemas import TranslationJobCreate, TranslationJobUpdate
from datetime import datetime

async def create_job(session: AsyncSession):
    repo = TranslationJobRepository(session)
    
    # Create job
    job_in = TranslationJobCreate(
        job_id="batch_001",
        total_records=1000,
    )
    job = await repo.create(job_in)
    
    # Start processing
    update = TranslationJobUpdate(
        status="processing",
        started_at=datetime.now(),
    )
    await repo.update(job.id, update)
    
    # Complete processing
    final_update = TranslationJobUpdate(
        status="completed",
        processed_records=1000,
        completed_at=datetime.now(),
    )
    await repo.update(job.id, final_update)
    
    await session.commit()
```

## Database Setup

### PostgreSQL with Docker

```bash
docker run --name ai-translation-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ai_translation \
  -p 5432:5432 \
  -d postgres:15-alpine
```

### Create .env file

Copy `.env.example` to `.env` and update with your database credentials:

```bash
cp .env.example .env
```

### Run the application

The database tables are automatically created on first run:

```bash
ai-translation-serve
```

## Connection Pooling

The database layer uses SQLAlchemy's connection pooling with configurable parameters:

- `DB_POOL_SIZE`: Maximum number of connections to keep in the pool (default: 20)
- `DB_MAX_OVERFLOW`: Maximum overflow connections (default: 0)

For production, adjust these based on your workload:

```env
# High-concurrency setup
DB_POOL_SIZE=50
DB_MAX_OVERFLOW=10
```

## Performance Considerations

1. **Indexes**: Frequently queried fields have indexes:
   - `(source_language, target_language)` on TranslationRecord
   - `created_at` on both models
   - `status` and `job_id` on TranslationJob

2. **Pagination**: Always use `skip` and `limit` parameters:
   ```python
   records = await repo.get_all(skip=0, limit=100)
   ```

3. **Connection Reuse**: Sessions are managed by FastAPI dependency injection and automatically closed

## Troubleshooting

### "Database not initialized" error

Ensure `init_db()` is called before making requests. This happens automatically with the lifespan context manager.

### Connection pool exhaustion

Increase `DB_POOL_SIZE` or reduce concurrent requests. Check `DB_ECHO_POOL=true` to debug pooling issues.

### Slow queries

Enable query logging with `DB_ECHO=true` and check indexes on frequently filtered fields.

## Next Steps

- Implement Alembic migrations for schema versioning
- Add query result caching
- Implement soft deletes for audit trail
- Add database event listeners for automatic audit logging
