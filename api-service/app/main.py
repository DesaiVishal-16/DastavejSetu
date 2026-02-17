# Main FastAPI application
from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from pathlib import Path
import os

from app.core.config import get_settings
from app.api.v1.endpoints import extraction, auth


def create_application() -> FastAPI:
    """Application factory pattern"""
    settings = get_settings()

    class MaxContentLengthMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request: Request, call_next):
            if (
                request.method == "POST"
                and request.url.path == "/api/v1/ai/file-extractor/extract"
            ):
                content_length = request.headers.get("content-length")
                if content_length:
                    max_size = settings.MAX_FILE_SIZE
                    if int(content_length) > max_size:
                        return Response(
                            content="File too large. Maximum size is 100MB.",
                            status_code=413,
                        )
            return await call_next(request)

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="""
        Udayam File Extractor API - Extract tables from PDFs, images, and scanned documents.
        
        ## Features
        
        * Upload PDFs, images, or scanned documents
        * Extract tables using AI (Google Gemini)
        * Translate content to preferred language
        * Download results as Excel file
        
        ## Usage
        
        1. Upload file to `/api/v1/ai/file-extractor/extract`
        2. Specify target language (optional, default: English)
        3. Download Excel from the provided download URL
        """,
        docs_url="/docs",
        redoc_url="/redoc",
        max_upload_size=settings.MAX_FILE_SIZE,
        timeout=600,
    )

    app.add_middleware(MaxContentLengthMiddleware)

    app.state.max_upload_size = 100 * 1024 * 1024

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routers
    app.include_router(
        extraction.router,
        prefix="/api/v1/ai/file-extractor",
        tags=["AI File Extractor"],
    )

    # Include auth router
    app.include_router(
        auth.router,
        prefix="/api/auth",
        tags=["Authentication"],
    )

    @app.get("/")
    async def root():
        return {
            "message": "Welcome to Udayam File Extractor API",
            "docs": "/docs",
            "version": settings.APP_VERSION,
        }

    @app.get("/health")
    async def health_check():
        return {"status": "healthy"}

    @app.get("/api/v1/files")
    async def get_file(path: str | None = None, filename: str | None = None):
        """Serve uploaded files for preview"""
        settings = get_settings()
        uploads_dir = Path(settings.UPLOAD_DIR)

        if path:
            if path.startswith("uploads/"):
                file_path = Path(path)
            else:
                file_path = uploads_dir / path

            if file_path.exists() and file_path.is_file():
                return FileResponse(
                    file_path,
                    media_type=get_media_type(file_path.name),
                    headers={
                        "Content-Disposition": f"inline; filename={file_path.name}"
                    },
                )

        if filename:
            for file_path in uploads_dir.rglob("*"):
                if file_path.is_file() and filename.lower() in file_path.name.lower():
                    return FileResponse(
                        file_path,
                        media_type=get_media_type(file_path.name),
                        headers={
                            "Content-Disposition": f"inline; filename={file_path.name}"
                        },
                    )

        return {"error": "File not found"}, 404

    def get_media_type(filename: str) -> str:
        ext = filename.lower().split(".")[-1]
        types = {
            "pdf": "application/pdf",
            "png": "image/png",
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "gif": "image/gif",
            "webp": "image/webp",
            "tiff": "image/tiff",
            "bmp": "image/bmp",
        }
        return types.get(ext, "application/octet-stream")

    return app


app = create_application()
