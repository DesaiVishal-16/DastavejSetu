# Frontend Technical Documentation

## Table of Contents

- [System Architecture](#system-architecture)
- [Services Overview](#services-overview)
- [API Endpoints](#api-endpoints)
- [Data Flow](#data-flow)
- [Authentication Flow](#authentication-flow)
- [File Extraction Flow](#file-extraction-flow)
- [Dashboard Data Flow](#dashboard-data-flow)
- [Database & Storage](#database--storage)
- [Environment Variables](#environment-variables)
- [Types & Interfaces](#types--interfaces)
- [Client Functions Reference](#client-functions-reference)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                             │
│                           http://localhost:3000                            │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │      HTTP Requests      │
                    └────────────┬────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   Auth API      │   │  File Extractor│   │  Static Files  │
│   (NestJS)      │   │  API (FastAPI) │   │  (Next.js)     │
│   Port: 3001    │   │  Port: 8000     │   │  Port: 3000    │
│   /api/auth/*   │   │  /api/v1/ai/*  │   │                │
└────────┬────────┘   └────────┬────────┘   └─────────────────┘
         │                    │
         │            ┌───────┴───────┐
         │            │               │
         ▼            ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│    NeonDB       │ │     Tigris     │ │  Google Gemini │
│  (PostgreSQL)  │ │   (S3 Storage) │ │      AI        │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## Services Overview

| Service          | Technology             | Port | Purpose                                               |
| ---------------- | ---------------------- | ---- | ----------------------------------------------------- |
| **Frontend**     | Next.js (React)        | 3000 | User interface, file upload, results display          |
| **API Server**   | NestJS (Node.js)       | 3001 | Authentication, session management, job orchestration |
| **API Service**  | FastAPI (Python)       | 8000 | AI-powered table extraction using Gemini              |
| **Database**     | NeonDB (PostgreSQL)    | -    | User data, sessions, extraction jobs                  |
| **File Storage** | Tigris (S3-compatible) | -    | Original files, extracted JSON results                |

---

## API Endpoints

### 1. Authentication API (API Server - Port 3001)

Base URL: `http://localhost:3001/api/auth`

| Method | Endpoint             | Description                  |
| ------ | -------------------- | ---------------------------- |
| POST   | `/api/auth/signup`   | Create new user account      |
| POST   | `/api/auth/login`    | Login via email (magic link) |
| GET    | `/api/auth/session`  | Get current session          |
| POST   | `/api/auth/sign-out` | Sign out user                |
| GET    | `/api/auth/me`       | Get current user profile     |

#### POST `/api/auth/signup`

Create a new user account.

| Property | Value                                   |
| -------- | --------------------------------------- |
| URL      | `http://localhost:3001/api/auth/signup` |
| Method   | POST                                    |
| Headers  | `Content-Type: application/json`        |
| Body     | `{ "email": string, "name": string }`   |
| Cookies  | `udayam.session_token` (set on success) |

**Response:**

```typescript
interface SignupResponse {
  success: boolean;
  message: string;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}
```

---

#### POST `/api/auth/login`

Login via email (magic link authentication).

| Property | Value                                   |
| -------- | --------------------------------------- |
| URL      | `http://localhost:3001/api/auth/login`  |
| Method   | POST                                    |
| Headers  | `Content-Type: application/json`        |
| Body     | `{ "email": string }`                   |
| Cookies  | `udayam.session_token` (set on success) |

**Response:**

```typescript
interface LoginResponse {
  success: boolean;
  message: string;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}
```

---

#### GET `/api/auth/session`

Get current authenticated user session.

| Property | Value                                    |
| -------- | ---------------------------------------- |
| URL      | `http://localhost:3001/api/auth/session` |
| Method   | GET                                      |
| Cookies  | `udayam.session_token` (send)            |

**Response:**

```typescript
interface SessionResponse {
  success: boolean;
  data: {
    user?: {
      id: string;
      email: string;
      name: string;
      image?: string;
    };
    expiresAt?: string;
  } | null;
}
```

---

#### POST `/api/auth/sign-out`

Sign out current user.

| Property | Value                                     |
| -------- | ----------------------------------------- |
| URL      | `http://localhost:3001/api/auth/sign-out` |
| Method   | POST                                      |
| Cookies  | Clears `udayam.session_token`             |

---

### 2. File Extractor API (API Service - Port 8000)

Base URL: `http://localhost:8000/api/v1/ai/file-extractor`

| Method | Endpoint                                           | Description                    |
| ------ | -------------------------------------------------- | ------------------------------ |
| POST   | `/api/v1/ai/file-extractor/extract`                | Upload file & start extraction |
| GET    | `/api/v1/ai/file-extractor/status/{job_id}`        | Get extraction status          |
| GET    | `/api/v1/ai/file-extractor/jobs`                   | Get all jobs                   |
| GET    | `/api/v1/ai/file-extractor/job/{id}`               | Get specific job               |
| GET    | `/api/v1/ai/file-extractor/stats`                  | Get dashboard stats            |
| GET    | `/api/v1/ai/file-extractor/usage`                  | Get usage statistics           |
| PUT    | `/api/v1/ai/file-extractor/extraction/{job_id}`    | Update extraction result       |
| GET    | `/api/v1/ai/file-extractor/original-file/{job_id}` | Get original file URL          |
| GET    | `/api/v1/ai/file-extractor/health`                 | Health check                   |

---

#### POST `/api/v1/ai/file-extractor/extract`

Upload a file for table extraction.

| Property     | Value                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| URL          | `http://localhost:8000/api/v1/ai/file-extractor/extract`                                                 |
| Method       | POST                                                                                                     |
| Content-Type | `multipart/form-data`                                                                                    |
| Body         | FormData with: <br> - `file`: File object <br> - `target_language`: "en" <br> - `preserve_names`: "true" |

**Response:**

```typescript
interface FileUploadResponse {
  success: boolean;
  message: string;
  job_id?: string;
  file_url?: string;
  data: ExtractionResult | null;
}
```

**Client Implementation:** Uses `XMLHttpRequest` for upload progress tracking.

---

#### GET `/api/v1/ai/file-extractor/status/{job_id}`

Poll extraction job status.

| Property | Value                                                            |
| -------- | ---------------------------------------------------------------- |
| URL      | `http://localhost:8000/api/v1/ai/file-extractor/status/{job_id}` |
| Method   | GET                                                              |

**Response:**

```typescript
interface ExtractionStatusResponse {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  file_url?: string;
  data?: ExtractionResult;
  error?: string;
}
```

**Polling Configuration:**

- Interval: 5000ms (5 seconds)
- Max attempts: 180 (timeout after ~15 minutes)

---

#### GET `/api/v1/ai/file-extractor/jobs`

Retrieve dashboard job list.

| Property | Value                                                               |
| -------- | ------------------------------------------------------------------- |
| URL      | `http://localhost:8000/api/v1/ai/file-extractor/jobs?limit={limit}` |
| Method   | GET                                                                 |

**Response:**

```typescript
interface DashboardResponse {
  jobs: DashboardJob[];
  stats: DashboardStats;
}
```

---

#### GET `/api/v1/ai/file-extractor/job/{id}`

Retrieve specific extraction job.

| Property | Value                                                     |
| -------- | --------------------------------------------------------- |
| URL      | `http://localhost:8000/api/v1/ai/file-extractor/job/{id}` |
| Method   | GET                                                       |

---

#### GET `/api/v1/ai/file-extractor/stats`

Get dashboard statistics.

| Property | Value                                                  |
| -------- | ------------------------------------------------------ |
| URL      | `http://localhost:8000/api/v1/ai/file-extractor/stats` |
| Method   | GET                                                    |

**Response:**

```typescript
interface DashboardStats {
  totalDocuments: number;
  processedThisMonth: number;
  successRate: number;
  processingTime: string;
}
```

---

#### GET `/api/v1/ai/file-extractor/usage`

Get user usage statistics.

| Property | Value                                                  |
| -------- | ------------------------------------------------------ |
| URL      | `http://localhost:8000/api/v1/ai/file-extractor/usage` |
| Method   | GET                                                    |

**Response:**

```typescript
interface UsageStats {
  documentsProcessed: number;
  documentsLimit: number;
  storageUsed: number;
  storageLimit: number;
  apiCalls: number;
  apiCallsLimit: number;
}
```

---

#### PUT `/api/v1/ai/file-extractor/extraction/{job_id}`

Save modified extraction results.

| Property | Value                                                                |
| -------- | -------------------------------------------------------------------- |
| URL      | `http://localhost:8000/api/v1/ai/file-extractor/extraction/{job_id}` |
| Method   | PUT                                                                  |
| Headers  | `Content-Type: application/json`                                     |
| Body     | `ExtractionResult` JSON                                              |

---

#### GET `/api/v1/ai/file-extractor/original-file/{job_id}`

Get signed URL for original uploaded file.

| Property | Value                                                                   |
| -------- | ----------------------------------------------------------------------- |
| URL      | `http://localhost:8000/api/v1/ai/file-extractor/original-file/{job_id}` |
| Method   | GET                                                                     |

---

## Data Flow

### Authentication Flow

```
┌─────────────────┐     POST /api/auth/signup      ┌─────────────────┐
│                 │  ──────────────────────────►  │                 │
│   Signup Page   │  {email, name}               │  API Server     │
│                 │                               │  (NestJS)       │
│                 │  ◄──────────────────────────  │  :3001          │
└─────────────────┘     SignupResponse            └────────┬────────┘
        │                                                │
        │                                               ▼
┌─────────────────┐     POST /api/auth/login     ┌─────────────────┐
│                 │  ──────────────────────────►  │                 │
│   Login Page    │  {email}                     │  API Server     │
│                 │                               │  (NestJS)       │
│                 │  ◄──────────────────────────  │  :3001          │
└─────────────────┘     LoginResponse           └────────┬────────┘
                                                         │
                                                         │ (sets session cookie)
                                                         ▼
                                              ┌─────────────────┐
                                              │    NeonDB       │
                                              │  (Sessions)     │
                                              └─────────────────┘
        │
        ▼
┌─────────────────┐     GET /api/auth/session   ┌─────────────────┐
│                 │  ─────────────────────────►│                 │
│  AuthContext    │  Cookie: session_token     │  API Server     │
│  (checkSession)│◄───────────────────────────  │  :3001          │
└─────────────────┘     SessionResponse       └─────────────────┘
        │
        ▼
┌─────────────────┐
│                 │
│   App State     │ ◄── user, isAuthenticated
│                 │
└─────────────────┘
```

### File Extraction Flow

```
┌─────────────────┐
│                 │
│  Upload Zone    │
│  (File Select)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     POST /api/v1/ai/file-extractor/extract
│                 │  ──(FormData with file)────────────────────►
│ uploadAndExtract│
│   File()        │     ┌─────────────────────────────────────────┐
│                 │     │         API Service (FastAPI)          │
│                 │     │              :8000                      │
│                 │     │                                         │
│                 │     │  1. Save file locally                   │
│                 │     │  2. Upload to Tigris S3                │
│                 │     │  3. Queue background job              │
│                 │     │  4. Call Gemini AI                     │
│                 │     │  5. Extract tables from PDF/image     │
│                 │     │  6. Save JSON to Tigris                │
└────────┬────────┘     └─────────────────────────────────────────┘
         │                    │
         │                    ▼
         │     ◄─── FileUploadResponse (job_id)
         │
         ▼
┌─────────────────┐     GET /api/v1/ai/file-extractor/status/{job_id}
│                 │  ─────────────────────────►
│ pollExtraction  │  ◄── ExtractionStatusResponse
│   Status()      │     (pending→processing→completed/failed)
│                 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│                 │
│  Results        │ ◄── ExtractionResult { tables, summary }
│  Preview       │
│                 │
└─────────────────┘
         │
         ▼
┌─────────────────┐     PUT /api/v1/ai/file-extractor/extraction/{id}
│                 │  ─────────────────────────►
│ exportToExcel   │     (save modified data to Tigris)
│ (client-side)   │
└─────────────────┘
```

### Dashboard Data Flow

```
┌─────────────────┐
│                 │
│  Dashboard      │
│  Page           │
└────────┬────────┘
         │
    ┌────┴────┬──────────────┐
    ▼         ▼              ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  /jobs          │ │  /stats         │ │  /usage         │
│                 │ │                 │ │                 │
│  - Job list     │ │  - Total docs   │ │  - API calls    │
│  - File names   │ │  - This month   │ │  - Documents    │
│  - Status       │ │  - Success rate │ │  - Storage      │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                  │                   │
         ▼                  ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    Dashboard View                            │
│  - Jobs Table                                              │
│  - Stats Cards (total, monthly, success rate)               │
│  - Usage Progress Bars                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Database & Storage

### NeonDB (PostgreSQL)

**Connection:** `postgresql://neondb_owner:npg_v5YckJr2msAz@ep-jolly-waterfall-a1p9haf8-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=verify-full`

**Purpose:** Stores user data, sessions, and extraction job records.

**Tables:**

- `user` - User accounts (id, name, email, image, createdAt, updatedAt)
- `session` - User sessions (id, userId, token, expiresAt, ipAddress, userAgent)
- `account` - OAuth accounts (for Google login)
- `verification` - Email verification tokens
- `otpLogs` - OTP attempt tracking
- `extractionJobs` - Extraction job records (id, userId, fileName, fileUrl, status, result, error)

---

### Tigris (S3 Storage)

**Endpoint:** `https://udayam-file-extract.t3.storage.dev/`
**Bucket:** `udayam-file-extract`

**Purpose:** Stores uploaded files and extracted JSON results.

**Storage Paths:**
| Path Pattern | Description |
|--------------|-------------|
| `uploads/{userId}/{timestamp}-{filename}` | Original uploaded files |
| `originals/{job_id}/{filename}` | Original files (from API service) |
| `extractions/{job_id}/{filename}.json` | Extracted JSON results |

**Operations:**

- Upload original files
- Upload extracted JSON data
- Generate signed URLs for file access

---

## Environment Variables

### Frontend (.env.local)

| Variable              | Required | Default | Description             |
| --------------------- | -------- | ------- | ----------------------- |
| `NEXT_PUBLIC_API_URL` | No       | (empty) | Base URL for API server |

When empty, uses relative paths (assumes proxy through Next.js).

---

### API Server (.env)

| Variable                   | Required | Default               | Description               |
| -------------------------- | -------- | --------------------- | ------------------------- |
| `PORT`                     | No       | 3001                  | Server port               |
| `NODE_ENV`                 | No       | development           | Environment               |
| `FRONTEND_URL`             | No       | http://localhost:3000 | Frontend URL for CORS     |
| `BASE_URL`                 | No       | http://localhost:3001 | Server base URL           |
| `PYTHON_API_URL`           | No       | http://localhost:8000 | Python API service URL    |
| `NEON_DATABASE_URL`        | Yes      | -                     | NeonDB connection string  |
| `BETTER_AUTH_SECRET`       | Yes      | -                     | Auth secret key           |
| `GOOGLE_CLIENT_ID`         | No       | -                     | Google OAuth client ID    |
| `GOOGLE_CLIENT_SECRET`     | No       | -                     | Google OAuth secret       |
| `TIGRIS_ENDPOINT`          | Yes      | -                     | Tigris S3 endpoint        |
| `TIGRIS_REGION`            | Yes      | auto                  | Tigris region             |
| `TIGRIS_ACCESS_KEY_ID`     | Yes      | -                     | Tigris access key         |
| `TIGRIS_SECRET_ACCESS_KEY` | Yes      | -                     | Tigris secret key         |
| `TIGRIS_BUCKET`            | Yes      | -                     | Tigris bucket name        |
| `FROM_EMAIL`               | No       | -                     | Email sender address      |
| `RESEND_API_KEY`           | No       | -                     | Resend API key for emails |

---

### API Service (.env)

| Variable                   | Required | Default                                              | Description           |
| -------------------------- | -------- | ---------------------------------------------------- | --------------------- |
| `GEMINI_API_KEY`           | Yes      | -                                                    | Google Gemini API key |
| `GEMINI_MODEL`             | No       | gemini-2.0-flash                                     | AI model to use       |
| `APP_NAME`                 | No       | Udayam File Extractor API                            | App name              |
| `APP_VERSION`              | No       | 1.0.0                                                | Version               |
| `DEBUG`                    | No       | false                                                | Debug mode            |
| `MAX_FILE_SIZE`            | No       | 104857600 (100MB)                                    | Max file size         |
| `UPLOAD_DIR`               | No       | uploads                                              | Temp upload directory |
| `ALLOWED_ORIGINS`          | No       | ["*"]                                                | CORS origins          |
| `ALLOWED_EXTENSIONS`       | No       | ["pdf","png","jpg","jpeg","tiff","bmp","gif","webp"] | Allowed file types    |
| `TIGRIS_ENDPOINT`          | Yes      | -                                                    | Tigris S3 endpoint    |
| `TIGRIS_REGION`            | Yes      | auto                                                 | Tigris region         |
| `TIGRIS_ACCESS_KEY_ID`     | Yes      | -                                                    | Tigris access key     |
| `TIGRIS_SECRET_ACCESS_KEY` | Yes      | -                                                    | Tigris secret key     |
| `TIGRIS_BUCKET`            | Yes      | -                                                    | Tigris bucket name    |

---

## Types & Interfaces

### Core Data Types

```typescript
interface TableData {
  tableName: string;
  headers: string[];
  rows: string[][];
}

interface ExtractionResult {
  tables: TableData[];
  summary: string;
}

interface FileUploadResponse {
  success: boolean;
  message: string;
  job_id?: string;
  file_url?: string;
  data: ExtractionResult | null;
}

interface ExtractionStatusResponse {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  file_url?: string;
  data?: ExtractionResult;
  error?: string;
}

interface DashboardStats {
  totalDocuments: number;
  processedThisMonth: number;
  successRate: number;
  processingTime: string;
}

interface DashboardJob {
  id: string;
  fileName: string;
  fileUrl: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  error?: string;
  result?: ExtractionResult;
}

interface DashboardResponse {
  jobs: DashboardJob[];
  stats: DashboardStats;
}

interface UsageStats {
  documentsProcessed: number;
  documentsLimit: number;
  storageUsed: number;
  storageLimit: number;
  apiCalls: number;
  apiCallsLimit: number;
}
```

---

## Client Functions Reference

### Auth Client (`lib/auth-client.ts`)

| Function              | Endpoint                  | Purpose                        |
| --------------------- | ------------------------- | ------------------------------ |
| `signup(email, name)` | POST `/api/auth/signup`   | Create new user account        |
| `login(email)`        | POST `/api/auth/login`    | Initiate email-based login     |
| `getSession()`        | GET `/api/auth/session`   | Get current authenticated user |
| `logout()`            | POST `/api/auth/sign-out` | Sign out current user          |

---

### API Client (`lib/api-client.ts`)

| Function                                   | Endpoint                                              | Purpose                         |
| ------------------------------------------ | ----------------------------------------------------- | ------------------------------- |
| `uploadAndExtractFile(file, onProgress?)`  | POST `/api/v1/ai/file-extractor/extract`              | Upload file & start extraction  |
| `pollExtractionStatus(jobId, onProgress?)` | GET `/api/v1/ai/file-extractor/status/{jobId}`        | Poll until extraction completes |
| `getExtractionResult(fileId)`              | GET `/api/v1/ai/file-extractor/status/{fileId}`       | Get extraction result           |
| `saveExtractionResult(fileId, data)`       | PUT `/api/v1/ai/file-extractor/extraction/{fileId}`   | Save modified extraction        |
| `exportToExcel(data, fileName)`            | Client-side                                           | Export result to Excel          |
| `getDashboardData(limit?)`                 | GET `/api/v1/ai/file-extractor/jobs`                  | Get dashboard jobs and stats    |
| `getExtractionJobById(jobId)`              | GET `/api/v1/ai/file-extractor/job/{jobId}`           | Get specific job details        |
| `getOriginalFileUrl(jobId)`                | GET `/api/v1/ai/file-extractor/original-file/{jobId}` | Get original file URL           |
| `getDashboardStats()`                      | GET `/api/v1/ai/file-extractor/stats`                 | Get dashboard statistics        |
| `getUsageStats()`                          | GET `/api/v1/ai/file-extractor/usage`                 | Get user usage limits           |

---

## Error Handling

All API functions handle errors gracefully:

- Network errors return `null` or `false` where appropriate
- HTTP errors throw descriptive `Error` objects
- Auth errors return `{ success: false, message: string }` responses

---

## Client-Side Utilities

### XLSX Export

The app uses the `xlsx` library for client-side Excel export:

- Adds "Sr No." column to each table
- Supports multiple sheets (one per table)
- Table names truncated to 31 chars (Excel limit)

---

## Project Structure

```
udayam-file-extractor/
├── frontend/                    # Next.js frontend
│   ├── lib/
│   │   ├── api-client.ts       # API calls for extraction
│   │   ├── auth-client.ts      # Authentication calls
│   │   └── utils.ts            # Utility functions
│   ├── contexts/
│   │   ├── auth-context.tsx    # Auth state management
│   │   └── language-context.tsx# i18n state
│   ├── components/             # React components
│   ├── docs/
│   │   └── technical-docs.md   # This file
│   └── .env.local             # Environment config
│
├── api-server/                 # NestJS API server
│   ├── src/
│   │   ├── auth/              # Authentication module
│   │   ├── extraction/        # Extraction orchestration
│   │   ├── storage/           # Tigris storage service
│   │   └── database/          # NeonDB schema
│   ├── .env                   # Environment config
│   └── TECHNICAL_DOCS.md      # API server docs
│
└── api-service/               # FastAPI Python service
    ├── app/
    │   ├── api/v1/endpoints/  # API endpoints
    │   ├── services/           # Business logic
    │   │   ├── gemini_service.py   # Gemini AI
    │   │   └── storage_service.py  # Tigris storage
    │   └── models/             # Pydantic schemas
    ├── uploads/                # Temp file storage
    ├── .env                    # Environment config
    └── TECHNICAL_DOCS.md      # API service docs
```
