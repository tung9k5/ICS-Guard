from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    AI_MODEL_NAME: str
    OLLAMA_URL: str
    GEMINI_API_KEY: str = ""

    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")

settings = Settings()
