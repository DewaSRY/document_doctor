from functools import lru_cache
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class DatabaseConfig(BaseSettings):
    """Database configuration from environment variables."""

    db_host: str = "localhost"
    db_port: int = 5432
    db_user: str = Field(
        default="postgres",
        validation_alias=AliasChoices("DB_USER", "POSTGRES_USER"),
    )
    db_password: str = Field(
        default="postgres",
        validation_alias=AliasChoices("DB_PASSWORD", "POSTGRES_PASSWORD"),
    )
    db_name: str = Field(
        default="ai_translation",
        validation_alias=AliasChoices("DB_NAME", "POSTGRES_DB"),
    )
    
    db_pool_size: int = 20
    db_max_overflow: int = 0
    db_echo: bool = False
    db_echo_pool: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="",
        case_sensitive=False,
        extra="ignore",
    )

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
