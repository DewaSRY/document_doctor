from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
    AsyncEngine,
)

from ai_translation.infrastructure.database.config import get_db_config
from ai_translation.infrastructure.database.models import Base

_engine: AsyncEngine | None = None
AsyncSessionLocal: async_sessionmaker[AsyncSession] | None = None


async def init_db() -> None:
    """Initialize database engine and session factory."""
    global _engine, AsyncSessionLocal

    config = get_db_config()

    _engine = create_async_engine(
        config.database_url,
        echo=config.db_echo,
        echo_pool=config.db_echo_pool,
        pool_size=config.db_pool_size,
        max_overflow=config.db_max_overflow,
    )

    AsyncSessionLocal = async_sessionmaker(
        _engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    """Close database engine and cleanup resources."""
    global _engine

    if _engine is not None:
        await _engine.dispose()
        _engine = None


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for getting an async database session.
    Used with FastAPI dependency injection.
    """
    if AsyncSessionLocal is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")

    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def get_async_engine() -> AsyncEngine:
    """Get the async database engine."""
    if _engine is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return _engine
