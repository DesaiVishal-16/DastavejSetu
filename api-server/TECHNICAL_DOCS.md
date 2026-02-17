# API Server - Technical Documentation

## Overview

The **API Server** is the main backend gateway built with **NestJS** (Node.js/TypeScript). It handles:

- **Authentication** via Supabase
- **File uploads** from Next.js frontend
- **Request proxying** to Python AI service
- **API routing** and validation

**Port**: 3001  
**Client**: Next.js Frontend (Port 3000)  
**Upstream**: Python API Service (Port 8000)

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Next.js       │────▶│  NestJS API      │────▶│  Python AI      │
│   Frontend      │     │  Server          │     │  Service        │
│   (Port 3000)   │◀────│  (Port 3001)     │◀────│  (Port 8000)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │
                                ▼
                         ┌──────────────┐
                         │  Supabase    │
                         │  Auth        │
                         └──────────────┘
```

---

## This Folder's Responsibilities

### What api-server DOES:

1. ✅ **Receive file uploads** from frontend
2. ✅ **Validate files** (type, size, format)
3. ✅ **Forward requests** to Python service
4. ✅ **Handle authentication** (Supabase JWT)
5. ✅ **Return JSON responses** to frontend
6. ✅ **Error handling** and logging

### What api-server DOES NOT do:

1. ❌ AI processing (done by Python service)
2. ❌ OCR/Table extraction (done by Python service)
3. ❌ Translation (done by Python service)
4. ❌ Database storage (use Supabase)

---

## Tech Stack (This Folder Only)

| Component   | Technology     | Version  | Purpose          |
| ----------- | -------------- | -------- | ---------------- |
| Framework   | NestJS         | ^11.0.1  | API framework    |
| Language    | TypeScript     | ^5.7.3   | Type safety      |
| HTTP Client | Axios          | ^1.13.5  | Call Python API  |
| File Upload | Multer         | built-in | Handle multipart |
| Config      | @nestjs/config | ^4.0.3   | Environment vars |
| Auth        | Supabase       | -        | JWT validation   |

---

## Dependencies on Other Folders

### Required Upstream Service:

- **api-service/** (Python FastAPI)
  - Must be running on port 8000
  - Handles AI extraction via Google Gemini
  - See: `../api-service/TECHNICAL_DOCS.md`

### Expected Downstream Client:

- **Next.js Frontend** (not in this repo yet)
  - Will call this API on port 3001
  - Handles UI and user interactions

---

## API Endpoints

### Base URL

```
http://localhost:3001
```

### 1. Health Check

```http
GET /health
```

**Response:**

```json
{ "status": "ok" }
```

### 2. Extract Document

```http
POST /api/v1/extraction/extract
Content-Type: multipart/form-data
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | File | Yes | PDF, PNG, JPG, JPEG, TIFF, BMP, GIF, WEBP |
| `target_language` | String | No | Language code (default: "en") |
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
        "rows": [["John Doe", "30", "New York"]]
      }
    ],
    "summary": "Document contains 1 table"
  }
}
```

**Error Response:**

```json
{
  "statusCode": 400,
  "message": "Invalid file type",
  "error": "Bad Request"
}
```

### 3. Python API Health Check

```http
GET /api/v1/extraction/health
```

**Purpose:** Check if Python AI service is available

---

## Performance Optimization

### 1. Request Handling Optimization

#### Enable Compression

```typescript
// In main.ts
import { CompressionMiddleware } from '@nestjs/common';

app.use(CompressionMiddleware());
```

#### Use Connection Pooling

```typescript
// In extraction.module.ts
HttpModule.register({
  timeout: 60000,
  maxRedirects: 5,
  // Enable keep-alive for connection reuse
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
});
```

### 2. Memory Optimization

#### Stream Large Files (Don't Buffer)

```typescript
// Instead of loading entire file into memory
// Use streams for files > 10MB
if (file.size > 10 * 1024 * 1024) {
  return this.extractionService.extractWithStream(file);
}
```

#### Set Memory Limits

```json
// In package.json scripts
{
  "start:prod": "node --max-old-space-size=2048 dist/main"
}
```

### 3. Response Time Optimization

#### Implement Request Queue

```typescript
// Use Bull/BullMQ with Redis for queue
@Injectable()
export class ExtractionQueue {
  constructor(@InjectQueue('extraction') private extractionQueue: Queue) {}

  async addToQueue(file: Express.Multer.File) {
    return this.extractionQueue.add(
      'extract',
      { file },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
  }
}
```

#### Implement Caching

```typescript
// Cache responses for identical files
@Injectable()
export class ExtractionService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async extractDocument(file: Express.Multer.File) {
    const fileHash = await this.computeFileHash(file);
    const cached = await this.cacheManager.get(fileHash);

    if (cached) {
      this.logger.log('Cache hit for file');
      return cached;
    }

    const result = await this.callPythonService(file);
    await this.cacheManager.set(fileHash, result, 3600); // 1 hour
    return result;
  }
}
```

### 4. Database Connection Pooling (Future)

```typescript
// If adding database
TypeOrmModule.forRoot({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  extra: {
    max: 20, // Maximum pool size
    idleTimeoutMillis: 30000, // Close idle connections after 30s
    connectionTimeoutMillis: 2000, // Timeout for new connections
  },
});
```

### 5. Load Balancing

#### PM2 Cluster Mode

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'api-server',
      script: 'dist/main.js',
      instances: 'max', // Use all CPU cores
      exec_mode: 'cluster',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '1G',
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
    },
  ],
};
```

#### NGINX Load Balancer

```nginx
upstream api_backend {
    least_conn;              # Least connections algorithm
    server localhost:3001;
    server localhost:3002;
    server localhost:3003;
    keepalive 32;           # Keep connections open
}

server {
    location /api/ {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_read_timeout 60s;
    }
}
```

---

## Edge Cases & Handling

### 1. File Upload Edge Cases

#### Empty File

```typescript
if (!file || file.size === 0) {
  throw new BadRequestException('File is empty');
}
```

#### Corrupted File

```typescript
// Validate file can be read
try {
  const buffer = file.buffer;
  // Check magic numbers for file type
  if (!this.validateFileSignature(buffer, file.mimetype)) {
    throw new BadRequestException('File appears to be corrupted');
  }
} catch (error) {
  throw new BadRequestException('Cannot read file');
}
```

#### Filename with Special Characters

```typescript
// Sanitize filename
const sanitizedFilename = file.originalname
  .replace(/[^a-zA-Z0-9.-]/g, '_')
  .substring(0, 255);
```

#### Concurrent Uploads (Same User)

```typescript
@Injectable()
export class RateLimitService {
  private userUploads = new Map<string, number>();

  canUpload(userId: string): boolean {
    const current = this.userUploads.get(userId) || 0;
    if (current >= 3) return false; // Max 3 concurrent

    this.userUploads.set(userId, current + 1);
    return true;
  }

  uploadComplete(userId: string) {
    const current = this.userUploads.get(userId) || 1;
    this.userUploads.set(userId, Math.max(0, current - 1));
  }
}
```

### 2. Network Edge Cases

#### Python Service Timeout

```typescript
// In extraction.service.ts
async extractDocument(file: Express.Multer.File) {
  try {
    return await this.httpService.post(
      url,
      formData,
      { timeout: 60000 }
    ).toPromise();
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      throw new HttpException(
        'Processing timeout. File may be too large or complex.',
        HttpStatus.REQUEST_TIMEOUT
      );
    }
    throw error;
  }
}
```

#### Python Service Down

```typescript
// Circuit breaker pattern
@Injectable()
export class CircuitBreakerService {
  private failures = 0;
  private lastFailureTime: number = 0;
  private readonly threshold = 5;
  private readonly timeout = 60000; // 1 minute

  async callPythonService(data: any) {
    if (this.isOpen()) {
      throw new ServiceUnavailableException(
        'Python service temporarily unavailable',
      );
    }

    try {
      const result = await this.httpService.post(url, data).toPromise();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private isOpen(): boolean {
    if (this.failures < this.threshold) return false;
    return Date.now() - this.lastFailureTime < this.timeout;
  }
}
```

#### Intermittent Network Issues

```typescript
// Retry with exponential backoff
async extractWithRetry(file: Express.Multer.File, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await this.extractDocument(file);
    } catch (error) {
      if (attempt === maxRetries) throw error;

      // Exponential backoff: 2s, 4s, 8s
      const delay = Math.pow(2, attempt) * 1000;
      this.logger.warn(`Retry attempt ${attempt} after ${delay}ms`);
      await this.sleep(delay);
    }
  }
}
```

### 3. Authentication Edge Cases

#### Expired Token

```typescript
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    try {
      const payload = this.jwtService.verify(token);

      // Check token expiration buffer (5 minutes)
      if (payload.exp - Date.now() / 1000 < 300) {
        throw new UnauthorizedException('Token expires soon');
      }

      request.user = payload;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
```

#### Missing User in Database

```typescript
async validateUser(userId: string) {
  const user = await this.supabase.auth.getUser(userId);

  if (!user.data.user) {
    throw new UnauthorizedException('User not found');
  }

  if (user.data.user.banned) {
    throw new ForbiddenException('User account suspended');
  }

  return user.data.user;
}
```

### 4. Resource Exhaustion Edge Cases

#### Memory Limit

```typescript
// Monitor memory usage
@Injectable()
export class MemoryGuard implements CanActivate {
  canActivate(): boolean {
    const used = process.memoryUsage();
    const usagePercent = (used.heapUsed / used.heapTotal) * 100;

    if (usagePercent > 90) {
      throw new ServiceUnavailableException(
        'Server under high load, please try again later',
      );
    }

    return true;
  }
}
```

#### Disk Space

```typescript
async checkDiskSpace() {
  const { free } = await checkDiskSpace('/tmp');
  const minFreeSpace = 100 * 1024 * 1024; // 100MB

  if (free < minFreeSpace) {
    this.logger.error('Low disk space');
    throw new ServiceUnavailableException('Server maintenance');
  }
}
```

### 5. Data Validation Edge Cases

#### Invalid Language Code

```typescript
const validLanguages = ['en', 'hi', 'es', 'fr', 'de', ...];

if (!validLanguages.includes(targetLanguage)) {
  throw new BadRequestException(
    `Invalid language code. Supported: ${validLanguages.join(', ')}`
  );
}
```

#### Malformed Form Data

```typescript
@UseInterceptors(
  FileInterceptor('file', {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
      files: 1,
    },
    fileFilter: (req, file, callback) => {
      if (!file.mimetype) {
        return callback(new BadRequestException('Invalid file'), false);
      }
      callback(null, true);
    },
  })
)
```

---

## Production Best Practices

### 1. Security Hardening

#### Helmet for Security Headers

```typescript
// In main.ts
import helmet from 'helmet';

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
);
```

#### Rate Limiting

```typescript
// In app.module.ts
import { ThrottlerModule } from '@nestjs/throttler';

ThrottlerModule.forRoot({
  throttlers: [
    {
      name: 'short',
      ttl: 1000, // 1 second
      limit: 10, // 10 requests per second
    },
    {
      name: 'long',
      ttl: 60000, // 1 minute
      limit: 100, // 100 requests per minute
    },
  ],
});
```

#### CORS Configuration

```typescript
// In main.ts - Production CORS
app.enableCors({
  origin: ['https://yourdomain.com', 'https://app.yourdomain.com'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400, // 24 hours
});
```

### 2. Logging & Monitoring

#### Structured Logging

```typescript
// In main.ts
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

const logger = WinstonModule.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});
```

#### Request Logging Middleware

```typescript
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      this.logger.log({
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userAgent: req.get('user-agent'),
        ip: req.ip,
      });
    });

    next();
  }
}
```

### 3. Graceful Shutdown

```typescript
// In main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable graceful shutdown
  app.enableShutdownHooks();

  // Handle SIGTERM
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing server...');
    await app.close();
    process.exit(0);
  });

  await app.listen(3001);
}
```

### 4. Health Checks

```typescript
@Controller('health')
export class HealthController {
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.http.pingCheck('python-api', 'http://localhost:8000/health'),
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      () => this.disk.checkStorage('disk', { thresholdPercent: 0.9 }),
    ]);
  }
}
```

---

## Monitoring & Alerting

### 1. Metrics to Track

| Metric             | Warning | Critical |
| ------------------ | ------- | -------- |
| Response Time      | > 500ms | > 2000ms |
| Error Rate         | > 1%    | > 5%     |
| Memory Usage       | > 70%   | > 90%    |
| CPU Usage          | > 70%   | > 90%    |
| Python API Latency | > 30s   | > 60s    |
| Active Connections | > 500   | > 1000   |

### 2. Alerting Rules

```yaml
# alerts.yml
groups:
  - name: api-server
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: 'High error rate detected'

      - alert: PythonServiceDown
        expr: up{job="python-api"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: 'Python AI service is down'
```

### 3. Dashboard Queries

```promql
# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m])

# P95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Active uploads
count(http_requests_total{path="/api/v1/extraction/extract"})
```

---

## Project Structure (This Folder)

```
api-server/
├── src/
│   ├── auth/                          # Supabase authentication
│   │   ├── auth.controller.ts
│   │   ├── auth.module.ts
│   │   └── auth.service.ts
│   │
│   ├── extraction/                    # Document extraction module
│   │   ├── dto/
│   │   │   └── extract-document.dto.ts     # Request DTO
│   │   ├── interfaces/
│   │   │   └── extraction.interface.ts     # TypeScript interfaces
│   │   ├── extraction.controller.ts        # Route handlers
│   │   ├── extraction.service.ts           # Business logic
│   │   └── extraction.module.ts            # Module config
│   │
│   ├── common/                        # Shared utilities
│   │   ├── filters/                   # Exception filters
│   │   ├── interceptors/              # Request/response interceptors
│   │   ├── guards/                    # Auth guards
│   │   └── pipes/                     # Validation pipes
│   │
│   ├── app.module.ts                  # Root module
│   └── main.ts                        # Entry point
│
├── .env.example                       # Environment template
├── package.json                       # Dependencies
├── tsconfig.json                      # TypeScript config
├── nest-cli.json                      # NestJS CLI config
└── TECHNICAL_DOCS.md                  # This file
```

---

## Configuration

### Environment Variables (api-server only)

```bash
# Server Settings
PORT=3001                                    # This server's port
NODE_ENV=development                         # Environment mode

# Frontend (CORS)
FRONTEND_URL=http://localhost:3000          # Next.js frontend URL

# Python API Service (Upstream)
PYTHON_API_URL=http://localhost:8000        # Python AI service URL
# ^^ See ../api-service/ for Python service config

# Supabase Auth
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### File Validation Rules

**Allowed MIME Types:**

- `application/pdf`
- `image/png`
- `image/jpeg`
- `image/jpg`
- `image/tiff`
- `image/bmp`
- `image/gif`
- `image/webp`

**Max File Size:** 50 MB

---

## Installation & Running

### Prerequisites

- Node.js 18+ or 20.x LTS
- pnpm (or npm/yarn)
- Python API service running on port 8000

### Setup

```bash
cd api-server

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your values

# Run in development (with hot reload)
pnpm run start:dev

# Run in production
pnpm run build
pnpm run start:prod
```

### Verify Setup

```bash
# Check this server
curl http://localhost:3001/health

# Check Python service (upstream)
curl http://localhost:3001/api/v1/extraction/health
```

---

## Docker (This Service Only)

### Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

EXPOSE 3001

CMD ["node", "dist/main"]
```

### Build & Run

```bash
docker build -t api-server .
docker run -p 3001:3001 --env-file .env api-server
```

---

## Error Handling

| Code  | When            | Cause                           |
| ----- | --------------- | ------------------------------- |
| `400` | Bad Request     | Invalid file type, missing file |
| `401` | Unauthorized    | Invalid Supabase JWT            |
| `500` | Server Error    | Python API unavailable          |
| `504` | Gateway Timeout | Python API took >60s            |

---

## Testing

```bash
# Unit tests
pnpm run test

# E2E tests
pnpm run test:e2e

# Coverage
pnpm run test:cov
```

---

## Integration with Other Services

### Calling from Frontend (Next.js)

```typescript
const formData = new FormData();
formData.append('file', pdfFile);
formData.append('target_language', 'hi');

const res = await fetch('http://localhost:3001/api/v1/extraction/extract', {
  method: 'POST',
  body: formData,
});

const data = await res.json();
// data.tables contains extracted tables
```

### Calling Python Service (Internal)

```typescript
// In extraction.service.ts
const response = await this.httpService
  .post(`${this.pythonApiUrl}/api/v1/ai/file-extractor/extract`, formData, {
    timeout: 60000,
  })
  .toPromise();
```

---

## Performance

- **Concurrent Requests**: 100-500
- **Response Time**: <50ms (without Python call)
- **Python Timeout**: 60 seconds
- **Memory**: ~512MB minimum

---

## Related Documentation

- **Python AI Service**: `../api-service/TECHNICAL_DOCS.md`
- **Main README**: `./README.md`
- **Environment Template**: `./.env.example`

---

## License

**Proprietary** - Udayam AI Labs

---

**Folder**: api-server/  
**Last Updated**: 2026-02-11  
**Version**: 1.0.0
