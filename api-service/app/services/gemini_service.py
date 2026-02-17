# Google Gemini Service for OCR and Translation
import json
import re
import base64
import logging
from typing import Optional, List
from pathlib import Path

from google import genai
from google.genai import types

from app.core.config import get_settings
from app.models.schemas import ExtractionResult, TableData
from app.utils.helpers import encode_file_to_base64, get_mime_type

logger = logging.getLogger(__name__)


def should_preprocess_pdf(file_path: str) -> bool:
    """Check if file is a PDF that should be converted to images - DEPRECATED
    Gemini now natively supports PDF files, so we don't need conversion anymore.
    Kept for backward compatibility fallback.
    """
    return False  # Always use direct PDF processing now


class GeminiService:
    """Service for extracting tables from documents using Google Gemini AI"""

    def __init__(self):
        settings = get_settings()
        self.api_key = settings.GEMINI_API_KEY
        self.model_name = settings.GEMINI_MODEL

        max_tokens = settings.GEMINI_MAX_OUTPUT_TOKENS
        if max_tokens is None:
            max_tokens = 40000

        if not self.api_key:
            raise ValueError(
                "GEMINI_API_KEY is not configured. Please set it in environment variables."
            )

        self.client = genai.Client(
            api_key=self.api_key,
            http_options={"timeout": 600},  # 10 minutes timeout for large files
        )
        self.max_output_tokens = max_tokens

    def extract_tables(
        self, file_path: str, target_language: str = "en", preserve_names: bool = True
    ) -> ExtractionResult:
        """
        Extract tables from a document (PDF, image, etc.)

        Args:
            file_path: Path to the file to process
            target_language: Target language code for translation (default: en)
            preserve_names: Whether to attempt preserving names clearly

        Returns:
            ExtractionResult with extracted tables
        """
        # Check file extension and size
        file_ext = Path(file_path).suffix.lower()

        # Check file size
        file_size = Path(file_path).stat().st_size / (1024 * 1024)  # Size in MB

        # For large PDFs (>10MB), use image-based processing
        if file_ext == ".pdf" and file_size > 10:
            return self._extract_from_pdf_with_images(
                file_path, target_language, preserve_names
            )

        # For smaller PDFs, use direct Gemini processing
        if file_ext == ".pdf":
            return self._extract_from_pdf_direct(
                file_path, target_language, preserve_names
            )

        # For images, process directly
        return self._extract_from_image(file_path, target_language, preserve_names)

    def _extract_from_pdf_direct(
        self, file_path: str, target_language: str = "en", preserve_names: bool = True
    ) -> ExtractionResult:
        """
        Extract tables from PDF directly using Gemini's native PDF support.
        Uses new SDK with structured output for better accuracy on large files.
        """
        try:
            base64_data = encode_file_to_base64(file_path)
            mime_type = "application/pdf"

            prompt = """Extract ALL tables from this document.
Output: Compact JSON only.
Schema: { "tables": [{ "tableName": "Page X Table Y", "headers": ["Col1", "Col2"], "rows": [["Val1", "Val2"]] }] }
Rules:
1. Extract every row and column accurately.
2. Use empty string "" for empty cells.
3. Output ONLY valid JSON, no explanations.
4. Merge tables that continue across page breaks - if multiple pages have tables with the same column headers, combine them into a single table.
5. Use a descriptive table name based on the content, not just "Page X Table Y"."""

            image_part = types.Part(
                inline_data=types.Blob(
                    mime_type=mime_type, data=base64.b64decode(base64_data)
                )
            )

            response = self.client.models.generate_content(
                model=self.model_name,
                contents=[image_part, prompt],
                config=types.GenerateContentConfig(
                    http_options=types.HttpOptions(timeout=600000),
                    max_output_tokens=self.max_output_tokens,
                    temperature=0.1,
                    thinking_config=types.ThinkingConfig(thinking_budget=0),
                    response_mime_type="application/json",
                    response_schema={
                        "type": "object",
                        "properties": {
                            "tables": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "tableName": {"type": "string"},
                                        "headers": {
                                            "type": "array",
                                            "items": {"type": "string"},
                                        },
                                        "rows": {
                                            "type": "array",
                                            "items": {
                                                "type": "array",
                                                "items": {"type": "string"},
                                            },
                                        },
                                    },
                                    "required": ["headers", "rows"],
                                },
                            }
                        },
                        "required": ["tables"],
                    },
                ),
            )

            if not response.text:
                raise ValueError(
                    "Empty response from AI. The document might be too large or unreadable."
                )

            tables = self._parse_extraction_response(response.text)

            return ExtractionResult(
                tables=tables, summary="Extraction completed successfully."
            )

        except Exception as e:
            error_msg = str(e)
            if "429" in error_msg or "quota" in error_msg.lower():
                raise ValueError(
                    "Rate limit exceeded. Please wait a moment and try again."
                )
            raise ValueError(f"Extraction failed: {error_msg}")

    def _extract_from_image(
        self, file_path: str, target_language: str = "en", preserve_names: bool = True
    ) -> ExtractionResult:
        """Extract tables from image files (PNG, JPG, TIFF, etc.) using new SDK"""
        base64_data = encode_file_to_base64(file_path)
        mime_type = get_mime_type(file_path)

        prompt = """Extract ALL tables from this document.
Output: Compact JSON only.
Schema: { "tables": [{ "tableName": "Page X Table Y", "headers": ["Col1", "Col2"], "rows": [["Val1", "Val2"]] }] }
Rules:
1. Extract every row and column accurately.
2. Use empty string "" for empty cells.
3. Output ONLY valid JSON, no explanations.
4. Merge tables that continue across page breaks - if multiple pages have tables with the same column headers, combine them into a single table.
5. Use a descriptive table name based on the content, not just "Page X Table Y"."""

        try:
            image_part = types.Part(
                inline_data=types.Blob(
                    mime_type=mime_type, data=base64.b64decode(base64_data)
                )
            )

            response = self.client.models.generate_content(
                model=self.model_name,
                contents=[image_part, prompt],
                config=types.GenerateContentConfig(
                    http_options=types.HttpOptions(timeout=600000),
                    max_output_tokens=self.max_output_tokens,
                    temperature=0.1,
                    thinking_config=types.ThinkingConfig(thinking_budget=0),
                    response_mime_type="application/json",
                    response_schema={
                        "type": "object",
                        "properties": {
                            "tables": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "tableName": {"type": "string"},
                                        "headers": {
                                            "type": "array",
                                            "items": {"type": "string"},
                                        },
                                        "rows": {
                                            "type": "array",
                                            "items": {
                                                "type": "array",
                                                "items": {"type": "string"},
                                            },
                                        },
                                    },
                                    "required": ["headers", "rows"],
                                },
                            }
                        },
                        "required": ["tables"],
                    },
                ),
            )

            if not response.text:
                raise ValueError(
                    "Empty response from AI. The document might be too large or unreadable."
                )

            tables = self._parse_extraction_response(response.text)

            return ExtractionResult(
                tables=tables, summary="Extraction completed successfully."
            )

        except Exception as e:
            error_msg = str(e)
            if "429" in error_msg or "quota" in error_msg.lower():
                raise ValueError(
                    "Rate limit exceeded. Please wait a moment and try again."
                )
            raise ValueError(f"Extraction failed: {error_msg}")

    def _extract_from_pdf_with_images(
        self, file_path: str, target_language: str = "en", preserve_names: bool = True
    ) -> ExtractionResult:
        """
        Extract tables from PDF by converting to images first.
        This is a fallback method if direct PDF processing fails.
        """
        try:
            from app.services.ocr_preprocessing_service import (
                get_ocr_preprocessing_service,
            )

            ocr_service = get_ocr_preprocessing_service()
            base64_images = ocr_service.process_file(file_path)

            if not base64_images:
                raise ValueError("Failed to convert PDF to images")

            all_tables = []

            prompt = """Extract ALL tables from this document page.
Output: Compact JSON only.
Schema: { "tables": [{ "tableName": "Page X Table Y", "headers": ["Col1", "Col2"], "rows": [["Val1", "Val2"]] }] }
Rules:
1. Extract every row and column accurately.
2. Use empty string "" for empty cells.
3. Output ONLY valid JSON, no explanations.
4. Merge tables that continue across page breaks - if multiple pages have tables with the same column headers, combine them into a single table.
5. Use a descriptive table name based on the content, not just "Page X Table Y"."""

            for page_num, base64_img in enumerate(base64_images, 1):
                image_part = types.Part(
                    inline_data=types.Blob(
                        mime_type="image/png", data=base64.b64decode(base64_img)
                    )
                )

                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=[image_part, prompt],
                    config=types.GenerateContentConfig(
                        http_options=types.HttpOptions(timeout=600000),
                        max_output_tokens=self.max_output_tokens,
                        temperature=0.1,
                        thinking_config=types.ThinkingConfig(thinking_budget=0),
                        response_mime_type="application/json",
                        response_schema={
                            "type": "object",
                            "properties": {
                                "tables": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "tableName": {"type": "string"},
                                            "headers": {
                                                "type": "array",
                                                "items": {"type": "string"},
                                            },
                                            "rows": {
                                                "type": "array",
                                                "items": {
                                                    "type": "array",
                                                    "items": {"type": "string"},
                                                },
                                            },
                                        },
                                        "required": ["headers", "rows"],
                                    },
                                }
                            },
                            "required": ["tables"],
                        },
                    ),
                )

                if response is None or not response.text:
                    continue

                page_tables = self._parse_extraction_response(response.text)

                if len(base64_images) > 1 and page_tables:
                    for table in page_tables:
                        table.tableName = f"{table.tableName} (Page {page_num})"

                all_tables.extend(page_tables)

            return ExtractionResult(
                tables=all_tables,
                summary=f"Extraction completed successfully. Processed {len(base64_images)} page(s).",
            )

        except ImportError:
            base64_data = encode_file_to_base64(file_path)
            mime_type = get_mime_type(file_path)
            return self._process_with_gemini(
                base64_data, mime_type, target_language, preserve_names
            )
        except Exception as e:
            raise ValueError(f"PDF extraction failed: {str(e)}")

    def _parse_extraction_response(self, response_text: str) -> List[TableData]:
        """Parse Gemini response and extract tables"""
        # Clean response text
        response_text = response_text.strip()

        # Handle markdown code blocks
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        elif response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]

        response_text = response_text.strip()

        # Try to parse JSON
        parsed = None

        # Strategy 1: Direct parse
        try:
            parsed = json.loads(response_text)
        except json.JSONDecodeError:
            # Strategy 2: Try to find array in response
            try:
                start = response_text.find("[")
                end = response_text.rfind("]")

                if start != -1 and end != -1 and end > start:
                    json_str = response_text[start : end + 1]
                    # Fix common issues
                    json_str = re.sub(r",(\s*[\]\}])", r"\1", json_str)
                    if json_str.count('"') % 2 != 0:
                        json_str += '"'

                    try:
                        parsed = json.loads(json_str)
                    except:
                        # Try adding missing brackets
                        opens = json_str.count("[") + json_str.count("{")
                        closes = json_str.count("]") + json_str.count("}")
                        if opens > closes:
                            json_str += "]" * (opens - closes)
                        try:
                            parsed = json.loads(json_str)
                        except:
                            pass
            except:
                pass

        if parsed is None:
            return []

        # Convert parsed data to TableData objects
        tables = []
        table_list = []

        if isinstance(parsed, list):
            table_list = parsed
        elif isinstance(parsed, dict):
            table_list = parsed.get("tables", [])

        # Handle new format with tableName, headers, rows
        if (
            table_list
            and isinstance(table_list[0], dict)
            and "headers" in table_list[0]
            and "rows" in table_list[0]
        ):
            for table_data in table_list:
                table_name = table_data.get("tableName", "Table")
                headers = table_data.get("headers") or table_data.get("h") or []
                rows = table_data.get("rows") or table_data.get("r") or []
                tables.append(
                    TableData(
                        tableName=str(table_name),
                        headers=[str(h) if h else "" for h in headers],
                        rows=[
                            [str(c) if c else "" for c in row]
                            for row in rows
                            if isinstance(row, list)
                        ],
                    )
                )

        return tables

    def _process_with_gemini(
        self,
        base64_data: str,
        mime_type: str,
        target_language: str = "en",
        preserve_names: bool = True,
    ) -> ExtractionResult:
        """Process file directly with Gemini (fallback method) using new SDK"""
        prompt = """Extract ALL tables from this document.
Output: Compact JSON only.
Schema: { "tables": [{ "tableName": "Page X Table Y", "headers": ["Col1", "Col2"], "rows": [["Val1", "Val2"]] }] }
Rules:
1. Extract every row and column accurately.
2. Use empty string "" for empty cells.
3. Output ONLY valid JSON, no explanations.
4. Merge tables that continue across page breaks - if multiple pages have tables with the same column headers, combine them into a single table.
5. Use a descriptive table name based on the content, not just "Page X Table Y"."""

        content_part = types.Part(
            inline_data=types.Blob(
                mime_type=mime_type, data=base64.b64decode(base64_data)
            )
        )

        response = self.client.models.generate_content(
            model=self.model_name,
            contents=[content_part, prompt],
            config=types.GenerateContentConfig(
                http_options=types.HttpOptions(timeout=600000),
                max_output_tokens=self.max_output_tokens,
                temperature=0.1,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
                response_mime_type="application/json",
                response_schema={
                    "type": "object",
                    "properties": {
                        "tables": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "tableName": {"type": "string"},
                                    "headers": {
                                        "type": "array",
                                        "items": {"type": "string"},
                                    },
                                    "rows": {
                                        "type": "array",
                                        "items": {
                                            "type": "array",
                                            "items": {"type": "string"},
                                        },
                                    },
                                },
                                "required": ["headers", "rows"],
                            },
                        }
                    },
                    "required": ["tables"],
                },
            ),
        )

        if response is None or not response.text:
            raise ValueError("Empty response from AI")

        tables = self._parse_extraction_response(response.text)

        return ExtractionResult(
            tables=tables, summary="Extraction completed successfully."
        )


# Singleton instance
gemini_service: Optional[GeminiService] = None


def get_gemini_service() -> GeminiService:
    """Get or create Gemini service singleton"""
    global gemini_service
    if gemini_service is None:
        gemini_service = GeminiService()
    return gemini_service
