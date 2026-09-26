# Database Quick Reference

Fast lookup guide for common database operations.

## Quick Start

```bash
# 1. Install dependencies
uv sync

# 2. Start PostgreSQL
docker run -d -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ai_translation \
  postgres:15-alpine

# 3. Run server
ai-translation-serve
```

## Import Statements

```python
# Configuration
from ai_translation.infrastructure.database import get_db_config

# Session management
from ai_translation.infrastructure.database import init_db, close_db, get_db_session

# Models
from ai_translation.infrastructure.database.models import TranslationRecord, TranslationJob

# Schemas
from ai_translation.infrastructure.database.schemas import (
    TranslationRecordCreate,
    TranslationRecordUpdate,
    TranslationRecordResponse,
    TranslationJobCreate,
    TranslationJobUpdate,
    TranslationJobResponse,
)

# Repositories
from ai_translation.infrastructure.database.repositories import (
    TranslationRecordRepository,
    TranslationJobRepository,
)
```

## Repository Operations

### TranslationRecordRepository

```python
from sqlalchemy.ext.asyncio import AsyncSession

repo = TranslationRecordRepository(session)

# Create
record = await repo.create(TranslationRecordCreate(...))

# Read
record = await repo.get_by_id(1)
records = await repo.get_all(skip=0, limit=10)

# Update
record = await repo.update(1, TranslationRecordUpdate(...))

# Delete
success = await repo.delete(1)

# Count
total = await repo.count()

# Queries
by_lang = await repo.get_by_languages("en", "id")
recent = await repo.get_recent(hours=24)
search = await repo.search_by_source_text("hello")
by_model = await repo.get_by_model_name("Qwen/Qwen2.5-7B")
```

### TranslationJobRepository

```python
repo = TranslationJobRepository(session)

# Create
job = await repo.create(TranslationJobCreate(job_id="job_1", total_records=100))

# Read
job = await repo.get_by_id(1)
job = await repo.get_by_job_id("job_1")

# Update
job = await repo.update(1, TranslationJobUpdate(status="processing"))

# Query
pending = await repo.get_pending_jobs()
processing = await repo.get_processing_jobs()
by_status = await repo.get_by_status("completed")
```

## FastAPI Dependency

```python
from fastapi import FastAPI, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from ai_translation.infrastructure.database import get_db_session

app = FastAPI()

@app.post("/endpoint")
async def my_endpoint(session: AsyncSession = Depends(get_db_session)):
    # session is automatically injected and closed after response
    repo = TranslationRecordRepository(session)
    # ... use repo ...
    await session.commit()
```

## Common Patterns

### Create and commit
```python
repo = TranslationRecordRepository(session)
record = await repo.create(record_data)
await session.commit()
```

### Read with error handling
```python
repo = TranslationRecordRepository(session)
record = await repo.get_by_id(1)
if record is None:
    raise HTTPException(status_code=404)
return record
```

### Update with rollback
```python
try:
    repo = TranslationRecordRepository(session)
    record = await repo.update(id, update_data)
    await session.commit()
except Exception:
    await session.rollback()
    raise
```

### Paginated query
```python
repo = TranslationRecordRepository(session)
total = await repo.count()
page_size = 20
page = 0

records = await repo.get_all(skip=page * page_size, limit=page_size)
```

### Search and filter
```python
repo = TranslationRecordRepository(session)

# By language pair
results = await repo.get_by_languages("en", "id", limit=10)

# By text
results = await repo.search_by_source_text("query", limit=10)

# Recent records
results = await repo.get_recent(hours=24, limit=50)
```

## Configuration

Set in `.env`:
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

Access in code:
```python
from ai_translation.infrastructure.database import get_db_config

config = get_db_config()
print(config.database_url)
```

## SQL Queries (Direct Access)

```bash
# Connect to database
psql -U postgres -d ai_translation

# View all translations
SELECT * FROM translation_records ORDER BY created_at DESC;

# View all jobs
SELECT * FROM translation_jobs;

# Count by language
SELECT source_language, target_language, COUNT(*) 
FROM translation_records 
GROUP BY source_language, target_language;

# Recent translations
SELECT * FROM translation_records 
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

# Job status summary
SELECT status, COUNT(*) FROM translation_jobs GROUP BY status;
```

## Testing

```python
import pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

@pytest.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession)
    async with SessionLocal() as sess:
        yield sess
    
    await engine.dispose()

@pytest.mark.asyncio
async def test_something(session):
    repo = TranslationRecordRepository(session)
    # ... test ...
```

## Debugging

Enable query logging:
```env
DB_ECHO=true
DB_ECHO_POOL=true
```

Check database size:
```bash
psql -U postgres -d ai_translation -c "SELECT pg_size_pretty(pg_database_size(current_database()));"
```

List all tables:
```bash
psql -U postgres -d ai_translation -c "\dt"
```

View table structure:
```bash
psql -U postgres -d ai_translation -c "\d translation_records"
```

Count records:
```bash
psql -U postgres -d ai_translation -c "SELECT COUNT(*) FROM translation_records;"
```

## Performance Tips

1. Always paginate large queries:
   ```python
   records = await repo.get_all(skip=0, limit=100)
   ```

2. Use specific queries instead of loading all:
   ```python
   # ❌ Bad
   all_records = await repo.get_all(limit=99999)
   filtered = [r for r in all_records if r.source_language == "en"]
   
   # ✅ Good
   filtered = await repo.get_by_languages("en", "id")
   ```

3. Set `DB_ECHO=false` in production

4. Use appropriate `DB_POOL_SIZE` for your workload:
   - Low traffic: 10-20
   - Medium traffic: 20-50
   - High traffic: 50-100

5. Monitor with `DB_ECHO=true` to identify slow queries

## Troubleshooting

| Error | Solution |
|-------|----------|
| `ModuleNotFoundError: sqlalchemy` | Run `uv sync` or `pip install -e .` |
| `Connection refused` | Start PostgreSQL: `docker run -d -p 5432:5432 postgres:15-alpine` |
| `Database does not exist` | Tables auto-create on startup, run server once |
| `QueuePool limit exceeded` | Increase `DB_POOL_SIZE` in .env |
| Slow queries | Set `DB_ECHO=true`, check indexes |
| Memory issues | Use pagination with `limit` parameter |

## See Also

- [DATABASE.md](./DATABASE.md) - Complete documentation
- [DATABASE_SETUP.md](./DATABASE_SETUP.md) - Setup guide
- [DATABASE_INTEGRATION_SUMMARY.md](./DATABASE_INTEGRATION_SUMMARY.md) - Architecture overview
