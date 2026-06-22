from typing import Any, Generic, Optional, TypeVar
from pydantic import BaseModel

T = TypeVar("T")

class ResponseSchema(BaseModel, Generic[T]):
    status: str = "success"
    message: str = "Success"
    data: Optional[T] = None

class ErrorResponseSchema(BaseModel):
    status: str = "error"
    message: str
    details: Optional[Any] = None

def success_response(data: Any = None, message: str = "Success") -> dict:
    """Helper for returning a unified success response dictionary."""
    return {
        "status": "success",
        "message": message,
        "data": data
    }

def error_response(message: str, details: Any = None) -> dict:
    """Helper for returning a unified error response dictionary."""
    return {
        "status": "error",
        "message": message,
        "details": details
    }
