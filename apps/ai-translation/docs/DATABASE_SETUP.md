# Database Setup Guide

Quick start guide for setting up and using the database layer.

## Prerequisites

- PostgreSQL 12+ or Docker installed
- Python 3.12+
- Dependencies installed: `sqlalchemy>=2.0.0`, `asyncpg>=0.29.0`, `pydantic-settings>=2.0.0`

## Installation

The required packages are already in `pyproject.toml`:

```bash
# Using uv (recommended)
uv sync

# Or using pip
pip install -e .
```

## Step 1: Start PostgreSQL

### Option A: Docker (Recommended)

```bash
# Create and start PostgreSQL container
docker run --name ai-translation-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ai_translation \
  -p 5432:5432 \
  -d postgres:15-alpine

# Verify it's running
docker logs ai-translation-db
```

### Option B: Local PostgreSQL

If you have PostgreSQL installed locally:

```bash
# Create database
createdb ai_translation

# Verify
psql -l | grep ai_translation
```

## Step 2: Configure Environment

```bash
# Copy example configuration
cp .env.example .env

# Edit .env with your database credentials (optional if using defaults)
# DB_HOST=localhost
# DB_PORT=5432
# DB_USER=postgres
# DB_PASSWORD=postgres
# DB_NAME=ai_translation
```

## Step 3: Verify Connection

Test the database connection:

```python
from ai_translation.infrastructure.database.config import get_db_config

config = get_db_config()
print(f"Database URL: {config.database_url}")
# Output: postgresql+asyncpg://postgres:postgres@localhost:5432/ai_translation
```

## Step 4: Start the Application

The database tables are automatically created on startup:

```bash
# Run the server
ai-translation-serve

# Server starts with automatic table creation
# 2024-09-26 12:00:00 - INFO - Starting AI Translation Service
# 2024-09-26 12:00:00 - INFO - Database initialized successfully
```

## Verification

### Check tables were created

```bash
# Connect to database
psql -U postgres -d ai_translation

# List tables
\dt

# Expected output:
#           List of relations
# Schema |         Name         | Type  |  Owner
# --------+----------------------+-------+----------
#  public | translation_records  | table | postgres
#  public | translation_jobs     | table | postgres
```

### Make a translation request

```bash
curl -X POST http://localhost:8000/v1/translate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello",
    "source_language": "en",
    "target_language": "id"
  }'

# Response includes the translation, and it's also saved to the database
```

### Query saved translations

```bash
# Using psql
psql -U postgres -d ai_translation

# SQL query
SELECT id, source_text, translated_text, source_language, target_language, created_at 
FROM translation_records 
ORDER BY created_at DESC 
LIMIT 5;
```

## Common Tasks

### View recent translations

```python
from sqlalchemy.ext.asyncio import AsyncSession
from ai_translation.infrastructure.database.repositories import TranslationRecordRepository

async def view_recent():
    # In actual code, session is provided by FastAPI
    repo = TranslationRecordRepository(session)
    
    recent = await repo.get_recent(hours=1, limit=10)
    for record in recent:
        print(f"{record.source_text} -> {record.translated_text}")

# Run in asyncio context
import asyncio
asyncio.run(view_recent())
```

### Track batch jobs

```python
from ai_translation.infrastructure.database.repositories import TranslationJobRepository
from ai_translation.infrastructure.database.schemas import TranslationJobCreate, TranslationJobUpdate
from datetime import datetime

async def track_job():
    repo = TranslationJobRepository(session)
    
    # Create job
    job = await repo.create(TranslationJobCreate(
        job_id="batch_001",
        total_records=1000,
    ))
    
    # Update progress
    await repo.update(job.id, TranslationJobUpdate(
        status="processing",
        started_at=datetime.now(),
    ))
    
    # Complete
    await repo.update(job.id, TranslationJobUpdate(
        status="completed",
        processed_records=1000,
        completed_at=datetime.now(),
    ))
```

### Export data

```bash
# Export as CSV
psql -U postgres -d ai_translation \
  -c "COPY translation_records TO STDOUT WITH CSV HEADER" \
  > translations.csv

# Export as JSON
psql -U postgres -d ai_translation \
  -c "SELECT json_agg(row_to_json(t)) FROM translation_records t" \
  > translations.json
```

## Troubleshooting

### "Connection refused" error

**Problem**: Cannot connect to PostgreSQL

**Solutions**:
```bash
# Check if PostgreSQL is running
docker ps | grep ai-translation-db

# Check database credentials in .env
cat .env | grep DB_

# Verify PostgreSQL port
lsof -i :5432

# Restart container
docker restart ai-translation-db
```

### "Database ai_translation does not exist"

**Problem**: Database wasn't created

**Solutions**:
```bash
# Connect as postgres user and create database
psql -U postgres -c "CREATE DATABASE ai_translation;"

# Or using Docker container
docker exec ai-translation-db psql -U postgres -c "CREATE DATABASE ai_translation;"
```

### "role 'postgres' does not exist"

**Problem**: PostgreSQL user doesn't exist

**Solutions**:
```bash
# Update .env with correct credentials
# Or create the user
docker exec ai-translation-db psql -U postgres -c "CREATE USER myuser WITH PASSWORD 'mypassword';"
docker exec ai-translation-db psql -U postgres -c "ALTER USER myuser CREATEDB;"
```

### Slow queries

**Enable query logging** (in .env):
```env
DB_ECHO=true
DB_ECHO_POOL=true
```

Then check logs for slow SQL queries.

### Connection pool exhaustion

**Symptoms**: "QueuePool limit exceeded" errors

**Solutions**:
```env
# Increase pool size
DB_POOL_SIZE=50
DB_MAX_OVERFLOW=10
```

## Cleanup

### Stop PostgreSQL container

```bash
docker stop ai-translation-db
docker rm ai-translation-db
```

### Drop database

```bash
docker exec ai-translation-db psql -U postgres -c "DROP DATABASE ai_translation;"
```

## Next Steps

1. Read [DATABASE.md](./DATABASE.md) for detailed API documentation
2. Run tests: `pytest src/ai_translation/infrastructure/database/`
3. Implement Alembic migrations for schema versioning
4. Set up automated backups for production

## Production Checklist

- [ ] Use strong database password
- [ ] Set `DB_ECHO=false` and `DB_ECHO_POOL=false`
- [ ] Configure `DB_POOL_SIZE` based on workload (typically 20-50)
- [ ] Enable PostgreSQL SSL: Update connection string to `postgresql+asyncpg://...?ssl=require`
- [ ] Set up regular backups
- [ ] Monitor slow queries with `log_min_duration_statement = 1000` in PostgreSQL
- [ ] Use connection pooling (pgBouncer) for high-concurrency scenarios
- [ ] Implement query caching layer
- [ ] Set up monitoring/alerting for database metrics

## References

- [SQLAlchemy 2.0 Async](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
- [asyncpg Documentation](https://magicstack.github.io/asyncpg/)
- [Pydantic Settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
