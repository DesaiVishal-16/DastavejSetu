# API Server

NestJS backend server for the Udayam File Extractor application. Handles authentication via Supabase, file uploads from Next.js frontend, and proxies extraction requests to the Python API service.

## Architecture

```
Next.js Frontend → NestJS API Server → Python API Service (AI Extraction)
                        ↓
                  Supabase Auth
```

## Features

- **Authentication**: Supabase integration for user auth
- **File Upload**: Accept PDFs, images from frontend
- **Proxy to Python Service**: Forwards extraction requests
- **Validation**: File type and size validation
- **CORS**: Configured for Next.js frontend

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and add your Supabase credentials
```

### 3. Run the Server

```bash
# Development
pnpm run start:dev

# Production
pnpm run build
pnpm run start:prod
```

## API Endpoints

### Health Check

```
GET /health
```

### Extract Document

```
POST /api/v1/extraction/extract
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

## Environment Variables

| Variable                    | Description                   | Default               |
| --------------------------- | ----------------------------- | --------------------- |
| `PORT`                      | Server port                   | 3001                  |
| `FRONTEND_URL`              | Next.js frontend URL          | http://localhost:3000 |
| `PYTHON_API_URL`            | Python extraction service URL | http://localhost:8000 |
| `SUPABASE_URL`              | Supabase project URL          | -                     |
| `SUPABASE_ANON_KEY`         | Supabase anon key             | -                     |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key     | -                     |

## Folder Structure

```
api-server/
├── src/
│   ├── auth/              # Supabase auth module
│   ├── extraction/        # Document extraction module
│   │   ├── dto/          # Data transfer objects
│   │   ├── interfaces/   # TypeScript interfaces
│   │   ├── extraction.controller.ts
│   │   ├── extraction.service.ts
│   │   └── extraction.module.ts
│   ├── app.module.ts
│   └── main.ts
├── .env.example
└── package.json
```

## Integration Flow

1. **Frontend (Next.js)** uploads document to `/api/v1/extraction/extract`
2. **NestJS API Server** validates file and auth
3. **NestJS** forwards request to Python API service
4. **Python Service** extracts tables using Gemini AI
5. **Python Service** returns JSON data
6. **NestJS** returns JSON to frontend

## Error Handling

All errors are returned in standard format:

```json
{
  "statusCode": 400,
  "message": "Error message",
  "error": "Bad Request"
}
```

## License

Udayam AI Labs
