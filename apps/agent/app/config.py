from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    anthropic_api_key: str = "sk-placeholder"
    database_url: str = "postgresql://localhost/backhaul"
    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: str = ""
    braintrust_api_key: str = ""
    stripe_secret_key: str = ""
    agent_service_secret: str = "dev-secret"
    sentry_dsn: str = ""
    environment: str = "development"
    skip_live_tests: bool = False
    allowed_origins: str = ""  # comma-separated list of additional CORS origins


settings = Settings()
