# Udayam AI File Extractor API

A FastAPI-based service for extracting structured tabular data from documents (PDFs, images, scans) using Google's Gemini AI, with optional translation to any language.

## Features

- **Multi-format Support**: PDF, PNG, JPG, JPEG, TIFF, BMP, GIF, WEBP
- **AI-Powered Extraction**: Uses Google Gemini for accurate table extraction
- **Translation**: Automatically translates content to preferred language
- **JSON Output**: Returns structured JSON data (no Excel generation)
- **Name Preservation**: Attempts to clearly identify names (marks unclear ones with [unclear])

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

### 3. Run the Server

```bash
# Development
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Production
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## API Endpoints

### Health Check

```
GET /health
```

### Extract Tables from File

```
POST /api/v1/ai/file-extractor/extract
Content-Type: multipart/form-data

Parameters:
- file: PDF, image, or scanned document (required)
- target_language: Language code (optional, default: "en")
- preserve_names: Boolean (optional, default: true)
```

**Example Response:**

```json
{
  "success": true,
  "message": "Extraction completed successfully",
  "data": {
    "tables": [
      {
        "tableName": "Page 1 Table 1",
        "headers": ["Name", "Age", "City"],
        "rows": [
          ["John Doe", "30", "New York"],
          ["Jane [unclear]", "25", "London"]
        ]
      }
    ],
    "summary": "Document contains 1 table with 2 rows"
  }
}
```

## Response Format

The API returns JSON data with the following structure:

```json
{
  "success": true,
  "message": "string",
  "data": {
    "tables": [
      {
        "tableName": "string",
        "headers": ["string"],
        "rows": [["string"]]
      }
    ],
    "summary": "string"
  }
}
```

## Folder Structure

```
api-service/
├── app/
│   ├── api/v1/endpoints/    # API routes
│   ├── core/                # Configuration
│   ├── models/              # Pydantic schemas
│   ├── services/            # Business logic
│   ├── utils/               # Helper functions
│   └── main.py              # FastAPI app
├── tests/                   # Test files
├── uploads/                 # Temporary uploads
├── requirements.txt
└── .env
```

## Configuration

| Variable           | Description           | Default                            |
| ------------------ | --------------------- | ---------------------------------- |
| GEMINI_API_KEY     | Google Gemini API key | (required)                         |
| GEMINI_MODEL       | Model to use          | gemini-3-flash-preview             |
| MAX_FILE_SIZE      | Max upload size       | 50MB                               |
| ALLOWED_EXTENSIONS | Supported formats     | pdf,png,jpg,jpeg,tiff,bmp,gif,webp |
| UPLOAD_DIR         | Upload storage        | uploads                            |

## Docker Support

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app/ ./app/

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## License

Udayam AI Labs
