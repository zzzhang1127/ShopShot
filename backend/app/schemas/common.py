from typing import TypeVar, Generic, Optional, List
from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    code: int = 0
    message: str = "success"
    data: Optional[T] = None


class Pagination(BaseModel):
    page: int = 1
    page_size: int = 20
    total: int = 0


class PaginatedData(BaseModel, Generic[T]):
    items: List[T] = []
    pagination: Pagination = Pagination()
