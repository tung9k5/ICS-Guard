
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Application Config
    PROJECT_NAME: str = "ICS-Guard Backend API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # CORS Config
    FRONTEND_URL: str

    # Database Config
    MONGO_URI: str
    MONGO_DB: str

    # JWT Authentication Config
    # Generate a secret key with: openssl rand -hex 32
    JWT_SECRET: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
