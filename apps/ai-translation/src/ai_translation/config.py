
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Server
    rest_host: str = "0.0.0.0"
    rest_port: int = 8000
    portal_api_token: str | None = None

    # Database
    database_url: str = "sqlite+aiosqlite:///./test.db"
    db_host: str | None = None
    db_port: int | None = None
    db_user: str | None = None
    db_password: str | None = None
    db_name: str | None = None

    # PostgreSQL Docker variables
    postgres_user: str | None = None
    postgres_password: str | None = None
    postgres_db: str | None = None

    # Development
    dev_mode: bool = False
    debug: bool = False

    # CORS - comma-separated origins
    cors_origins: str = "http://localhost:3000,http://localhost:8000,https://localhost"

    # CORS - comma-separated allowed headers
    cors_allow_headers: str = "Origin,Content-Type,Authorization,X-Timezone,X-Request-Id"

    # Rate Limiting
    rate_limit: str = "100/minute"

    # Model configuration
    hf_token: str | None = None
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="",
        case_sensitive=False,
        extra="ignore",
    )

    def get_cors_origins_list(self) -> list[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def get_cors_allow_headers_list(self) -> list[str]:
        """Parse comma-separated allowed CORS headers into a list."""
        return [header.strip() for header in self.cors_allow_headers.split(",") if header.strip()]


settings = Settings()
