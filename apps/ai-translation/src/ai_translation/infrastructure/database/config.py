import os
from functools import lru_cache
from pydantic import ConfigDict
from pydantic_settings import BaseSettings


class DatabaseConfig(BaseSettings):
    """Database configuration from environment variables."""

    db_host: str = os.environ.get("DB_HOST", "localhost")
    db_port: int = int(os.environ.get("DB_PORT", "5432"))
    db_user: str = os.environ.get("DB_USER", os.environ.get("POSTGRES_USER", "postgres"))
    db_password: str = os.environ.get("DB_PASSWORD", os.environ.get("POSTGRES_PASSWORD", "postgres"))
    db_name: str = os.environ.get("DB_NAME", os.environ.get("POSTGRES_DB", "ai_translation"))
    db_pool_size: int = 20
    db_max_overflow: int = 0
    db_echo: bool = False
    db_echo_pool: bool = False

    model_config = ConfigDict(env_prefix="", case_sensitive=False)

    @property
    def database_url(self) -> str:
        """Build PostgreSQL async connection URL."""
        return (
            f"postgresql+asyncpg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def database_url_sync(self) -> str:
        """Build PostgreSQL sync connection URL (for migrations)."""
        return (
            f"postgresql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


@lru_cache(maxsize=1)
def get_db_config() -> DatabaseConfig:
    """Get cached database configuration."""
    return DatabaseConfig()
