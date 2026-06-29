from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    AI_MODEL_NAME: str
    OLLAMA_URL: str

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
