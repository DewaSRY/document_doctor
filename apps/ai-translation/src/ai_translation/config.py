from typing import Optional

from pydantic import ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Server
    rest_host: str = "0.0.0.0"
    rest_port: int = 8000
    grpc_port: Optional[int] = None

    # Database
    database_url: str = "sqlite+aiosqlite:///./test.db"
    db_host: Optional[str] = None
    db_port: Optional[int] = None
    db_user: Optional[str] = None
    db_password: Optional[str] = None
    db_name: Optional[str] = None

    # PostgreSQL Docker variables
    postgres_user: Optional[str] = None
    postgres_password: Optional[str] = None
    postgres_db: Optional[str] = None

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
    hf_token: Optional[str] = None
    qwen_model_name: Optional[str] = None

    model_config = ConfigDict(env_file=".env", case_sensitive=False, env_prefix="")

    def get_cors_origins_list(self) -> list[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def get_cors_allow_headers_list(self) -> list[str]:
        """Parse comma-separated allowed CORS headers into a list."""
        return [header.strip() for header in self.cors_allow_headers.split(",") if header.strip()]


settings = Settings()
