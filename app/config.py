from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    admin_password: str
    allowed_origins: str = "http://localhost:5173"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    model_config = {"env_file": ".env"}


settings = Settings()
