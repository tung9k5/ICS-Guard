import os
from pathlib import Path


def load_root_environment():
    """Load the shared root .env without adding another runtime dependency."""
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


load_root_environment()

from fastapi import FastAPI
import uvicorn

from app.api.routes import router

app = FastAPI(
    title="ICS-Guard AI Engine API",
    description="API phân tích sự cố bảo mật tự động bằng AI",
    version="1.0.0"
)

app.include_router(router)

# Nếu bạn muốn chạy file này trực tiếp
if __name__ == "__main__":
    reload_enabled = os.getenv("AI_RELOAD", "false").lower() == "true"
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=reload_enabled)
