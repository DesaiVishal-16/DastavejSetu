# Pydantic models for data validation
from typing import List, Optional
from pydantic import BaseModel


class TableData(BaseModel):
    """Model representing extracted table data"""

    tableName: str = "Extracted Table"
    headers: List[str] = []
    rows: List[List[str]] = []


class ExtractionResult(BaseModel):
    """Model representing the complete extraction result"""

    tables: List[TableData] = []
    summary: Optional[str] = ""


class ExtractionRequest(BaseModel):
    """Model for extraction request"""

    target_language: Optional[str] = "en"  # Target language for translation
    preserve_names: Optional[bool] = True  # Whether to attempt preserving names clearly


class FileUploadResponse(BaseModel):
    """Model for file upload response - returns JSON data only"""

    success: bool
    message: str
    job_id: Optional[str] = None
    file_url: Optional[str] = None
    data: Optional[ExtractionResult] = None
