# Configuration management
import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # API Configuration
    APP_NAME: str = "Udayam File Extractor API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Gemini API Configuration
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"
    GEMINI_MAX_OUTPUT_TOKENS: int | None = 40000

    # File Upload Configuration
    MAX_FILE_SIZE: int = 100 * 1024 * 1024  # 100MB
    ALLOWED_EXTENSIONS: set = {
        "pdf",
        "png",
        "jpg",
        "jpeg",
        "tiff",
        "bmp",
        "gif",
        "webp",
    }
    UPLOAD_DIR: str = "uploads"
    OUTPUT_DIR: str = "outputs"

    # Tigris S3 Storage Configuration
    TIGRIS_ENDPOINT: str = ""
    TIGRIS_REGION: str = "auto"
    TIGRIS_ACCESS_KEY_ID: str = ""
    TIGRIS_SECRET_ACCESS_KEY: str = ""
    TIGRIS_BUCKET: str = ""

    # Validation Configuration
    ENABLE_VALIDATION: bool = True  # Enable post-processing validation
    MAX_RETRY_ATTEMPTS: int = 2  # Number of retry attempts for low confidence

    # OCR Configuration
    OCR_DPI: int = 300  # DPI for PDF conversion (300-600 recommended)
    OCR_DESKEW: bool = True  # Enable automatic deskewing
    OCR_DENOISE: bool = True  # Enable noise removal
    OCR_CONTRAST_ENHANCE: bool = True  # Enable contrast enhancement

    # CORS Configuration
    ALLOWED_ORIGINS: list = ["*"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
