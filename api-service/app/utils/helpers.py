# Utility functions
import re
import os
import base64
from pathlib import Path
from typing import Optional


def sanitize_sheet_name(name: str, max_length: int = 31) -> str:
    """
    Sanitize sheet name to meet Excel's strict constraints:
    - Cannot contain: \ / ? * [ ] :
    - Max 31 characters
    - Cannot start/end with apostrophe
    """
    # Remove illegal characters
    sanitized = re.sub(r"[\[\]\*\/\?\:\\\\]", " ", name)

    # Trim whitespace
    sanitized = sanitized.strip()

    # Remove leading/trailing apostrophes
    sanitized = re.sub(r"^'+|'+$", "", sanitized)

    # Collapse multiple spaces
    sanitized = re.sub(r"\s+", " ", sanitized)

    # Truncate to max length
    sanitized = sanitized[:max_length]

    # Final apostrophe check after truncation
    sanitized = re.sub(r"^'+|'+$", "", sanitized)

    return sanitized or "Sheet"


def resolve_name_collision(name: str, used_names: set, max_length: int = 31) -> str:
    """Resolve Excel sheet name collisions by adding numeric suffix"""
    final_name = name
    counter = 1

    while final_name.lower() in used_names:
        suffix = f"-{counter}"
        available_space = max_length - len(suffix)
        base = name[:available_space]
        base = re.sub(r"^'+|'+$", "", base)
        final_name = base + suffix
        counter += 1

    return final_name


def encode_file_to_base64(file_path: str) -> str:
    """Encode file to base64 string"""
    with open(file_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def get_mime_type(file_path: str) -> str:
    """Get MIME type based on file extension"""
    extension = Path(file_path).suffix.lower()

    mime_types = {
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".tiff": "image/tiff",
        ".tif": "image/tiff",
        ".bmp": "image/bmp",
        "": "image/gif",
        ".webp": "image/webp",
    }

    return mime_types.get(extension, "application/octet-stream")


def ensure_directories():
    """Ensure upload and output directories exist"""
    from app.core.config import get_settings

    settings = get_settings()

    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
