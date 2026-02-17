# API Service - Technical Documentation

## Overview

The **API Service** is the AI processing backend built with **Python/FastAPI**. It handles:

- **Document OCR** using Google Gemini AI
- **Table extraction** from PDFs and images
- **Language translation** of extracted content
- **JSON data generation**

**Port**: 8000  
**Upstream**: NestJS API Server (Port 3001)  
**External**: Google Gemini AI API

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   NestJS        │────▶│  Python FastAPI  │────▶│  Google Gemini  │
│   API Server    │     │  Service         │     │  AI             │
│   (Port 3001)   │◀────│  (Port 8000)     │◀────│                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │  Temp Files  │
                        │  (Uploads)   │
                        └──────────────┘
```

---

## This Folder's Responsibilities

### What api-service DOES:

1. ✅ **AI-powered OCR** using Google Gemini
2. ✅ **Table extraction** from documents
3. ✅ **Translation** to target languages
4. ✅ **Name preservation** with [unclear] marking
5. ✅ **JSON data generation**
6. ✅ **Temporary file handling**

### What api-service DOES NOT do:

1. ❌ Authentication (done by NestJS)
2. ❌ File validation (done by NestJS)
3. ❌ User management (use Supabase)
4. ❌ Database storage

---

## Tech Stack (This Folder Only)

| Component  | Technology        | Version                | Purpose        |
| ---------- | ----------------- | ---------------------- | -------------- |
| Framework  | FastAPI           | ^0.104.1               | API framework  |
| Language   | Python            | 3.11+                  | Core language  |
| AI Model   | Google Gemini     | gemini-3-flash-preview | OCR/Extraction |
| Validation | Pydantic          | ^2.5.0                 | Data models    |
| Config     | pydantic-settings | ^2.1.0                 | Environment    |
| Server     | Uvicorn           | ^0.24.0                | ASGI server    |

---

## Dependencies on Other Folders

### Expected Caller:

- **api-server/** (NestJS)
  - Must call this service on port 8000
  - Handles auth and file validation before calling
  - See: `../api-server/TECHNICAL_DOCS.md`

### External Dependencies:

- **Google Gemini API**
  - Requires `GEMINI_API_KEY`
  - Handles AI processing
  - Subject to rate limits

---

## API Endpoints

### Base URL

```
http://localhost:8000
```

### 1. Health Check

```http
GET /health
```

**Response:**

```json
{
  "status": "healthy",
  "service": "udayam-ai-file-extractor"
}
```

### 2. Extract Tables (Main Endpoint)

```http
POST /api/v1/ai/file-extractor/extract
Content-Type: multipart/form-data
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | File | Yes | PDF, PNG, JPG, JPEG, TIFF, BMP, GIF, WEBP |
| `target_language` | String | No | Target language code (default: "en") |
| `preserve_names` | Boolean | No | Mark unclear names (default: true) |

**Success Response:**

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

**Error Response:**

```json
{
  "detail": "Invalid file type. Allowed: pdf, png, jpg, jpeg, tiff, bmp, gif, webp"
}
```

---

## Performance Optimization

### 1. Gemini API Optimization

#### Batch Processing

```python
# Process multiple pages in single request when possible
async def extract_tables_batch(file_path: str, pages: List[int]):
    """Extract from multiple pages in one API call"""
    # Gemini can handle multi-page PDFs efficiently
    # Don't split unless necessary
    return await self.gemini_service.extract_tables(file_path)
```

#### Prompt Optimization

```python
# Optimized prompt for faster processing
OPTIMIZED_PROMPT = """Extract tables. JSON: {"tables":[{"tableName":"string","headers":[],"rows":[]}]}.
Rules:
1. Merge continued tables
2. Empty cells: ""
3. Only JSON, no text
4. Translate to {lang}
5. Unclear names: [unclear]"""
```

#### Response Caching

```python
# Cache Gemini responses for identical files
from functools import lru_cache
import hashlib

class GeminiService:
    def __init__(self):
        self.cache = {}

    async def extract_tables(self, file_path: str, target_language: str = "en"):
        # Generate file hash
        file_hash = self._get_file_hash(file_path)
        cache_key = f"{file_hash}:{target_language}"

        # Check cache
        if cache_key in self.cache:
            logger.info("Cache hit")
            return self.cache[cache_key]

        # Process and cache
        result = await self._call_gemini(file_path, target_language)
        self.cache[cache_key] = result
        return result

    def _get_file_hash(self, file_path: str) -> str:
        hasher = hashlib.md5()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b''):
                hasher.update(chunk)
        return hasher.hexdigest()
```

### 2. File Handling Optimization

#### Streaming for Large Files

```python
# Don't load entire file into memory
async def process_large_file(file_path: str):
    file_size = os.path.getsize(file_path)

    if file_size > 10 * 1024 * 1024:  # 10MB
        # Process in chunks
        return await process_in_chunks(file_path)
    else:
        # Process normally
        return await process_file(file_path)
```

#### Async File Operations

```python
import aiofiles

async def encode_file_async(file_path: str) -> str:
    """Asynchronously read and encode file"""
    async with aiofiles.open(file_path, 'rb') as f:
        content = await f.read()
        return base64.b64encode(content).decode('utf-8')
```

### 3. Connection Optimization

#### Connection Pooling

```python
import httpx

class GeminiService:
    def __init__(self):
        # Use connection pooling
        self.client = httpx.AsyncClient(
            limits=httpx.Limits(
                max_keepalive_connections=20,
                max_connections=100
            ),
            timeout=httpx.Timeout(60.0)
        )

    async def close(self):
        await self.client.aclose()
```

#### Keep-Alive Headers

```python
# In gemini_service.py
headers = {
    'Connection': 'keep-alive',
    'Keep-Alive': 'timeout=60, max=1000'
}
```

### 4. Worker Optimization

#### Uvicorn Workers

```bash
# Optimal worker count = (2 x CPU cores) + 1
# For 4 cores: 9 workers
uvicorn app.main:app --workers 9 --host 0.0.0.0 --port 8000
```

#### Worker Configuration

```python
# In main.py
if __name__ == "__main__":
    import multiprocessing

    workers = (multiprocessing.cpu_count() * 2) + 1

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        workers=workers,
        loop="uvloop",  # Faster event loop
        http="httptools",  # Faster HTTP parser
        reload=False,  # Disable in production
    )
```

### 5. Memory Optimization

#### Streaming Uploads

```python
from fastapi import UploadFile

@app.post("/extract")
async def extract_document(
    file: UploadFile = File(...),
    chunk_size: int = 1024 * 1024  # 1MB chunks
):
    # Stream file to disk instead of loading into RAM
    file_path = await save_streaming(file, chunk_size)
    try:
        result = await process_file(file_path)
        return result
    finally:
        os.unlink(file_path)  # Cleanup
```

#### Garbage Collection

```python
import gc

@app.middleware("http")
async def gc_middleware(request, call_next):
    response = await call_next(request)
    gc.collect()  # Force garbage collection after each request
    return response
```

---

## Edge Cases & Handling

### 1. Gemini API Edge Cases

#### Rate Limiting (429 Error)

```python
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential

class GeminiService:
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type(RateLimitError)
    )
    async def extract_tables(self, file_path: str):
        try:
            return await self._call_gemini(file_path)
        except Exception as e:
            if "429" in str(e) or "quota" in str(e).lower():
                raise RateLimitError(f"Rate limit exceeded: {e}")
            raise
```

#### Empty Response

```python
async def extract_tables(self, file_path: str):
    response = await self._call_gemini(file_path)

    if not response or not response.text:
        logger.warning("Empty response from Gemini")
        return ExtractionResult(
            tables=[],
            summary="No tables detected in document"
        )
```

#### Malformed JSON Response

````python
import json

async def parse_response(response_text: str):
    """Handle various JSON formats from Gemini"""
    # Remove markdown code blocks
    text = response_text.strip()
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON: {e}")
        # Attempt to extract JSON from text
        return extract_json_from_text(text)

def extract_json_from_text(text: str) -> dict:
    """Extract JSON object from text using regex"""
    import re
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        return json.loads(match.group())
    raise ValueError("No valid JSON found in response")
````

#### Gemini Service Unavailable (503)

```python
@app.exception_handler(GeminiUnavailableError)
async def gemini_unavailable_handler(request, exc):
    return JSONResponse(
        status_code=503,
        content={
            "detail": "AI service temporarily unavailable. Please try again in a few moments.",
            "retry_after": 30
        },
        headers={"Retry-After": "30"}
    )
```

### 2. File Processing Edge Cases

#### Corrupted PDF

```python
import PyPDF2

async def validate_pdf(file_path: str):
    """Check if PDF is readable"""
    try:
        with open(file_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            num_pages = len(reader.pages)
            if num_pages == 0:
                raise ValueError("PDF has no pages")
            return True
    except Exception as e:
        logger.error(f"Invalid PDF: {e}")
        raise ValueError(f"Corrupted or invalid PDF file: {e}")
```

#### Password-Protected PDF

```python
async def check_pdf_password(file_path: str):
    """Detect password-protected PDFs"""
    try:
        with open(file_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            if reader.is_encrypted:
                raise ValueError("Password-protected PDFs are not supported")
    except Exception as e:
        if "Password" in str(e):
            raise ValueError("Password-protected PDFs are not supported")
        raise
```

#### Scanned Images (No Text Layer)

```python
# Gemini handles this well, but add warning in response
async def process_scanned_document(file_path: str):
    result = await extract_tables(file_path)

    if not result.tables or all(len(t.rows) == 0 for t in result.tables):
        result.summary += " (Document appears to be image-only or scanned)"

    return result
```

#### Unsupported Image Formats

```python
from PIL import Image

async def validate_image(file_path: str):
    """Validate image can be opened"""
    try:
        with Image.open(file_path) as img:
            img.verify()  # Verify image

        # Reopen to check it's readable
        with Image.open(file_path) as img:
            img.load()

        return True
    except Exception as e:
        raise ValueError(f"Invalid or corrupted image: {e}")
```

### 3. Large File Edge Cases

#### Files > 50MB

```python
@app.post("/extract")
async def extract_document(file: UploadFile = File(...)):
    MAX_SIZE = 50 * 1024 * 1024  # 50MB

    # Check file size before processing
    file.file.seek(0, 2)  # Seek to end
    file_size = file.file.tell()
    file.file.seek(0)  # Reset

    if file_size > MAX_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size: 50MB. Your file: {file_size / 1024 / 1024:.1f}MB"
        )
```

#### Multi-page PDFs (>100 pages)

```python
async def handle_large_pdf(file_path: str):
    """Split very large PDFs"""
    import PyPDF2

    with open(file_path, 'rb') as f:
        reader = PyPDF2.PdfReader(f)
        num_pages = len(reader.pages)

        if num_pages > 100:
            logger.warning(f"Large PDF detected: {num_pages} pages")
            # Process in batches
            return await process_pdf_in_batches(file_path, batch_size=50)

    return await extract_tables(file_path)
```

#### Memory Exhaustion

```python
import psutil

async def check_memory():
    """Check available memory before processing"""
    memory = psutil.virtual_memory()
    if memory.percent > 90:
        raise HTTPException(
            status_code=503,
            detail="Server under high load. Please try again later."
        )

@app.post("/extract")
async def extract_document(file: UploadFile = File(...)):
    await check_memory()
    # ... rest of processing
```

### 4. Network Edge Cases

#### Timeout Handling

```python
from httpx import Timeout

# Configure timeouts
timeout = Timeout(
    connect=10.0,      # Connection timeout
    read=60.0,         # Read timeout
    write=10.0,        # Write timeout
    pool=5.0           # Pool timeout
)

async def call_gemini_with_timeout(file_path: str):
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(...)
            return response
    except httpx.ReadTimeout:
        raise HTTPException(
            status_code=504,
            detail="AI processing timeout. Document may be too complex."
        )
```

#### Connection Drops

```python
# Retry on connection errors
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((httpx.ConnectError, httpx.NetworkError))
)
async def robust_gemini_call(file_path: str):
    return await self._call_gemini(file_path)
```

### 5. Concurrent Processing Edge Cases

#### Race Conditions

```python
import asyncio
from asyncio import Lock

class FileProcessor:
    def __init__(self):
        self.processing_locks = {}

    async def process_file(self, file_id: str, file_path: str):
        # Create lock for this file
        if file_id not in self.processing_locks:
            self.processing_locks[file_id] = Lock()

        async with self.processing_locks[file_id]:
            # Only one process per file at a time
            return await self._process(file_path)
```

#### Disk Space Exhaustion

```python
import shutil

async def check_disk_space():
    """Check available disk space"""
    usage = shutil.disk_usage("/tmp")
    free_gb = usage.free / (1024 ** 3)

    if free_gb < 1:  # Less than 1GB free
        raise HTTPException(
            status_code=507,
            detail="Insufficient storage space. Please try again later."
        )

@app.post("/extract")
async def extract_document(file: UploadFile = File(...)):
    await check_disk_space()
    # ... rest of processing
```

---

## Production Best Practices

### 1. Security Hardening

#### Input Sanitization

```python
import magic

async def validate_file_type(file_path: str):
    """Validate actual file type using magic numbers"""
    detected = magic.from_file(file_path, mime=True)
    allowed = ['application/pdf', 'image/png', 'image/jpeg', ...]

    if detected not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"File type mismatch. Detected: {detected}"
        )
```

#### Secure File Storage

```python
import tempfile
import uuid

async def save_upload_securely(upload_file: UploadFile):
    """Save file with secure random name"""
    # Generate random filename
    file_id = str(uuid.uuid4())

    # Use temp directory
    temp_dir = tempfile.gettempdir()
    file_path = os.path.join(temp_dir, f"{file_id}_{upload_file.filename}")

    # Write file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)

    # Set restrictive permissions
    os.chmod(file_path, 0o600)

    return file_path
```

### 2. Logging & Monitoring

#### Structured Logging

```python
import structlog

logger = structlog.get_logger()

@app.post("/extract")
async def extract_document(file: UploadFile = File(...)):
    logger.info(
        "processing_extraction",
        file_name=file.filename,
        file_size=file.size,
        target_language=target_language
    )

    try:
        result = await process_file(file)
        logger.info(
            "extraction_success",
            tables_count=len(result.tables),
            processing_time=processing_time
        )
        return result
    except Exception as e:
        logger.error(
            "extraction_failed",
            error=str(e),
            error_type=type(e).__name__
        )
        raise
```

#### Performance Metrics

```python
from prometheus_client import Counter, Histogram

# Metrics
extraction_requests = Counter(
    'extraction_requests_total',
    'Total extraction requests',
    ['status']
)

extraction_duration = Histogram(
    'extraction_duration_seconds',
    'Extraction processing time',
    buckets=[1, 5, 10, 30, 60, 120]
)

@app.post("/extract")
async def extract_document(file: UploadFile = File(...)):
    start_time = time.time()

    try:
        result = await process_file(file)
        extraction_requests.labels(status='success').inc()
        return result
    except Exception as e:
        extraction_requests.labels(status='error').inc()
        raise
    finally:
        duration = time.time() - start_time
        extraction_duration.observe(duration)
```

### 3. Graceful Shutdown

```python
import signal
import sys

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down gracefully...")

    # Cancel pending tasks
    tasks = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]

    for task in tasks:
        task.cancel()

    await asyncio.gather(*tasks, return_exceptions=True)

    # Cleanup temp files
    cleanup_temp_files()

    logger.info("Shutdown complete")

def signal_handler(sig, frame):
    logger.info(f"Received signal {sig}")
    sys.exit(0)

signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)
```

### 4. Health Checks

```python
from fastapi import APIRouter
import psutil

health_router = APIRouter()

@health_router.get("/health")
async def health_check():
    """Comprehensive health check"""
    checks = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": settings.APP_VERSION,
        "checks": {
            "gemini_api": await check_gemini_api(),
            "disk_space": check_disk_space(),
            "memory": check_memory(),
        }
    }

    # If any check fails, return unhealthy
    if not all(checks["checks"].values()):
        raise HTTPException(status_code=503, detail=checks)

    return checks

async def check_gemini_api():
    try:
        # Quick ping to Gemini
        return True
    except:
        return False

def check_disk_space():
    usage = shutil.disk_usage("/tmp")
    return (usage.free / usage.total) > 0.1  # At least 10% free

def check_memory():
    memory = psutil.virtual_memory()
    return memory.percent < 90
```

---

## Monitoring & Alerting

### 1. Key Metrics

| Metric             | Warning | Critical | Action              |
| ------------------ | ------- | -------- | ------------------- |
| Gemini API Latency | > 15s   | > 30s    | Scale workers       |
| Error Rate         | > 5%    | > 10%    | Check Gemini status |
| Memory Usage       | > 70%   | > 90%    | Restart workers     |
| Disk Usage         | > 80%   | > 95%    | Cleanup temp files  |
| Queue Length       | > 10    | > 50     | Scale horizontally  |
| Gemini Rate Limit  | > 50%   | > 80%    | Implement backoff   |

### 2. Alerting Rules

```yaml
# alerts.yml
groups:
  - name: api-service
    rules:
      - alert: GeminiHighLatency
        expr: histogram_quantile(0.95, extraction_duration_seconds) > 30
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'Gemini API latency is high'

      - alert: ExtractionErrorRate
        expr: rate(extraction_requests_total{status="error"}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: 'High extraction error rate'

      - alert: DiskSpaceLow
        expr: (disk_free_bytes / disk_total_bytes) < 0.1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: 'Disk space below 10%'
```

### 3. Dashboard Queries (PromQL)

```promql
# Extraction success rate
rate(extraction_requests_total{status="success"}[5m])

# Average processing time
rate(extraction_duration_seconds_sum[5m]) / rate(extraction_duration_seconds_count[5m])

# Gemini API calls per minute
rate(gemini_api_calls_total[1m])

# Active temp files
count(uploads_dir_files)

# Memory usage
process_resident_memory_bytes / 1024 / 1024  # MB
```

---

## Project Structure (This Folder)

```
api-service/
├── app/
│   ├── api/v1/endpoints/              # API routes
│   │   ├── extraction.py              # Main extraction endpoint
│   │   └── __init__.py
│   │
│   ├── core/                          # Configuration
│   │   ├── config.py                  # Environment settings
│   │   └── __init__.py
│   │
│   ├── models/                        # Pydantic schemas
│   │   ├── schemas.py                 # Data models
│   │   └── __init__.py
│   │
│   ├── services/                      # Business logic
│   │   ├── gemini_service.py          # Google Gemini integration
│   │   └── __init__.py
│   │
│   ├── utils/                         # Helper functions
│   │   ├── helpers.py                 # File encoding, sanitization
│   │   └── __init__.py
│   │
│   ├── __init__.py
│   └── main.py                        # FastAPI application entry
│
├── uploads/                           # Temporary file storage
├── tests/                             # Test files
├── requirements.txt                   # Python dependencies
├── .env.example                       # Environment template
├── .env                               # Environment (gitignored)
└── TECHNICAL_DOCS.md                  # This file
```

---

## Configuration

### Environment Variables (api-service only)

```bash
# Required
GEMINI_API_KEY=your_api_key_here           # Get from Google AI Studio

# Optional - API Settings
GEMINI_MODEL=gemini-3-flash-preview        # AI model
GEMINI_MAX_OUTPUT_TOKENS=40000             # Max response size
APP_NAME=Udayam AI File Extractor
APP_VERSION=1.0.0
DEBUG=false

# File Upload
MAX_FILE_SIZE=52428800                     # 50MB in bytes
UPLOAD_DIR=uploads                         # Temp storage
ALLOWED_ORIGINS=*                          # CORS (should restrict in prod)
```

### Google Gemini Settings

**Model**: `gemini-3-flash-preview`

- Fast processing
- Good for structured data extraction
- Max 40,000 output tokens

**Processing Limits:**

- **Rate Limit**: 60 requests/minute (free tier)
- **Processing Time**: 3-15 seconds per document
- **File Size**: Up to 50MB

---

## Installation & Running

### Prerequisites

- Python 3.11+
- pip or pipenv
- Google Gemini API key

### Setup

```bash
cd api-service

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add GEMINI_API_KEY

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run production server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Verify Setup

```bash
# Check health
curl http://localhost:8000/health

# Test extraction
curl -X POST "http://localhost:8000/api/v1/ai/file-extractor/extract" \
  -F "file=@test.pdf" \
  -F "target_language=en"
```

---

## Docker (This Service Only)

### Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

RUN mkdir -p uploads

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### Build & Run

```bash
docker build -t api-service .
docker run -p 8000:8000 --env-file .env api-service
```

---

## AI Prompt Engineering

The service uses this prompt for Gemini:

```python
prompt = f"""Act as a high-precision document parser and translator.
Extract ALL tables from ALL pages of this document.
Output Format: Compact JSON only.
Schema: {{ "tables": [{{ "tableName": "Page X Table Y", "headers": ["Col1", "Col2"], "rows": [["Val1", "Val2"]] }}], "summary": "brief summary" }}
Critical Rules:
1. Merge tables that continue across page breaks.
2. Preserve every row and column accurately.
3. If a cell is empty, use "".
4. No conversational text, only valid JSON.
5. Translate ALL text content to {target_language} language.
6. Preserve names of people, places, and organizations as clearly as possible. If a name is unclear, mark it with [unclear]."""
```

---

## Performance

| Metric                  | Value                      |
| ----------------------- | -------------------------- |
| **Concurrent Requests** | 10-50 (depends on workers) |
| **Processing Time**     | 3-15 seconds per document  |
| **File Size Limit**     | 50 MB                      |
| **Output Tokens**       | 40,000 max                 |
| **Rate Limit**          | 60 req/min (free tier)     |

### Resource Requirements

- **CPU**: 2 cores minimum, 4+ recommended
- **RAM**: 1 GB minimum, 2+ GB recommended
- **Disk**: 5 GB for temp uploads

---

## Error Handling

| Code  | When         | Cause                           |
| ----- | ------------ | ------------------------------- |
| `400` | Bad Request  | Invalid file, malformed request |
| `429` | Rate Limited | Gemini API quota exceeded       |
| `500` | Server Error | AI processing failed            |
| `503` | Unavailable  | Gemini service down             |

---

## Testing

```bash
# Run tests
pytest tests/ -v

# Check test coverage
pytest tests/ --cov=app
```

---

## Integration with NestJS

This service is designed to be called by the NestJS API server:

```typescript
// In api-server extraction.service.ts
const response = await this.httpService
  .post('http://localhost:8000/api/v1/ai/file-extractor/extract', formData, {
    timeout: 60000,
  })
  .toPromise();

return response.data; // Returns JSON to frontend
```

---

## Key Files

- **main.py** - FastAPI app initialization
- **gemini_service.py** - AI processing logic
- **extraction.py** - API endpoint handlers
- **schemas.py** - Pydantic data models
- **config.py** - Environment configuration

---

## Related Documentation

- **NestJS API Server**: `../api-server/TECHNICAL_DOCS.md`
- **Main README**: `./README.md`
- **Environment Template**: `./.env.example`

---

## License

**Proprietary** - Udayam AI Labs

---

**Folder**: api-service/  
**Last Updated**: 2026-02-11  
**Version**: 1.0.0
