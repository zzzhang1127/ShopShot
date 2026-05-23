from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse


class ShopShotException(Exception):
    def __init__(self, code: int, message: str, data=None):
        self.code = code
        self.message = message
        self.data = data


async def shopshot_exception_handler(request: Request, exc: ShopShotException):
    return JSONResponse(
        status_code=200,
        content={"code": exc.code, "message": exc.message, "data": exc.data},
    )


async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=200,
        content={"code": exc.status_code, "message": exc.detail, "data": None},
    )


async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=200,
        content={"code": 500, "message": str(exc), "data": None},
    )
