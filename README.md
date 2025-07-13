# ZUZU Ingester

A high-performance hotel review data ingestion service that processes JSON Lines (.jl) files from multiple platforms (Agoda, Booking.com) and stores them in a PostgreSQL database.

## 🚀 Quick Start

### Prerequisites

- **Bun** (v1.0+) - [Install Bun](https://bun.sh/docs/installation)
- **Docker & Docker Compose** - [Install Docker](https://docs.docker.com/get-docker/)
- **PostgreSQL** (optional, for local development without Docker)

### Option 1: Docker Setup (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd zuzu-ingester
   ```

2. **Start the services**
   ```bash
   docker-compose up -d
   ```

3. **Access the application**
   - API: http://localhost:3000
   - Swagger UI: http://localhost:3000/docs
   - Database: localhost:5433 (postgres/password)

### Option 2: Local Development

1. **Install dependencies**
   ```bash
   bun install
   ```

2. **Set up the database**
   ```bash
   # Start PostgreSQL (if not using Docker)
   # Update DATABASE_URL in your environment if needed
   
   # Run database migrations
   bun run db:migrate
   ```

3. **Start the development server**
   ```bash
   bun run dev
   ```

4. **Access the application**
   - API: http://localhost:3000
   - Swagger UI: http://localhost:3000/docs

## 📁 Project Structure

```
zuzu-ingester/
├── src/
│   ├── api/                    # API routes and handlers
│   ├── application/            # Business logic and services
│   │   ├── services/
│   │   │   ├── file-process/   # File processing services
│   │   │   └── jobs/          # Job management services
│   ├── domain/                 # Domain models and interfaces
│   ├── infrastructure/         # External integrations
│   │   ├── database/          # Database schema and repositories
│   │   ├── local/             # Local file processor
│   │   └── s3/                # S3 file processor
│   ├── types/                 # TypeScript type definitions
│   └── utils/                 # Utility functions
├── data/                      # Sample data files
├── tests/                     # Test files
├── docs/                      # Documentation
└── docker-compose.yml         # Docker services configuration
```

## 🔧 Available Scripts

### Development
```bash
bun run dev              # Start development server with hot reload
bun run build            # Build for production
bun run format           # Format code with Biome
```

### Testing
```bash
bun run test             # Run tests
bun run test:watch       # Run tests in watch mode
```

### Database
```bash
bun run db:generate      # Generate new migration
bun run db:migrate       # Run database migrations
bun run db:push          # Push schema changes to database
bun run db:studio        # Open Drizzle Studio
bun run db:check         # Check database schema
bun run db:drop          # Drop database (⚠️ destructive)
```

## 🗄️ Database Setup

The application uses PostgreSQL with Drizzle ORM. The database schema includes:

- **hotels** - Hotel information and metadata
- **reviews** - Hotel review data
- **reviewers** - Reviewer information
- **processing_jobs** - Job tracking for file processing

### Database Connection

- **Local**: `postgresql://postgres:password@localhost:5433/zuzu_ingester`
- **Docker**: `postgresql://postgres:password@postgres:5432/zuzu_ingester`

## 📊 API Endpoints

### File Processing
- `POST /api/processing/process-file` - Process a hotel review file
- `GET /api/processing/jobs/:jobId` - Get job status
- `GET /api/processing/jobs` - List all jobs

### Health Check
- `GET /api/health` - Application health status

### Documentation
- `GET /docs` - Swagger UI documentation

## 🔄 File Processing

The service supports processing JSON Lines (.jl) files from:

- **Agoda** - Hotel reviews from Agoda platform
- **Booking.com** - Hotel reviews from Booking.com platform

### Processing Features

- **Streaming Processing** - Processes large files in chunks
- **Data Validation** - Validates records against schemas
- **Database Storage** - Stores hotels and reviews in PostgreSQL
- **Job Tracking** - Tracks processing jobs with status updates
- **Error Handling** - Comprehensive error handling and logging

### Supported Storage Providers

- **Local** - Process files from local filesystem
- **S3** - Process files from AWS S3 (requires credentials)

## 🧪 Testing

### Run Tests
```bash
# Run all tests
bun run test

# Run tests in watch mode
bun run test:watch

# Run specific test file
bun test tests/utils/logger.test.ts
```

### Test Structure
- **Unit Tests** - Individual component testing
- **Integration Tests** - Service integration testing
- **API Tests** - Endpoint testing

## 🐳 Docker

### Services
- **app** - Main application (port 3000)
- **postgres** - PostgreSQL database (port 5433)

### Environment Variables
```bash
DATABASE_URL=postgresql://postgres:password@postgres:5432/zuzu_ingester
S3_BUCKET=zuzu-inbox
S3_REGION=ap-south-1
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
```

### 🔑 S3 Configuration

**⚠️ Important: You must update S3 credentials before using S3 file processing!**

The application requires AWS S3 credentials to process files from S3. Update the following files with your actual S3 credentials:

#### 1. Docker Compose (for Docker setup)
Edit `docker-compose.yml`:
```yaml
environment:
  - S3_BUCKET=your-s3-bucket-name
  - S3_REGION=your-aws-region
  - S3_ACCESS_KEY=your-aws-access-key
  - S3_SECRET_KEY=your-aws-secret-key
```

#### 2. Test Script (for API testing)
Edit `test-api.sh`:
```bash
S3_BUCKET="your-s3-bucket-name"
S3_REGION="your-aws-region"
S3_ACCESS_KEY="your-aws-access-key"
S3_SECRET_KEY="your-aws-secret-key"
```

#### 3. Environment Variables (for local development)
Set these environment variables in your shell or `.env` file:
```bash
export S3_BUCKET=your-s3-bucket-name
export S3_REGION=your-aws-region
export S3_ACCESS_KEY=your-aws-access-key
export S3_SECRET_KEY=your-aws-secret-key
```

#### 4. AWS S3 Requirements
- **Bucket**: Must exist and be accessible
- **Permissions**: Read access to bucket and objects
- **Region**: Must match your S3 bucket region
- **Credentials**: Valid AWS access key and secret key

#### 5. Testing S3 Configuration
After updating credentials, test S3 connectivity:
```bash
# Test with the API script
./test-api.sh s3

# Or test via API directly
curl -X POST http://localhost:3000/api/processing/process-file \
  -H "Content-Type: application/json" \
  -d '{
    "filepath": "your-s3-file-path.jl",
    "platform": "agoda",
    "storageProvider": "s3",
    "options": {
      "storeToDatabase": true
    }
  }'
```

## 📝 Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the existing code structure
   - Add tests for new functionality
   - Update documentation if needed

3. **Run tests and formatting**
   ```bash
   bun run format
   bun run test
   ```

4. **Submit a pull request**
   - Include a clear description of changes
   - Reference any related issues

## 🔍 Debugging

### Logs
The application uses structured logging with different levels:
- **DEBUG** - Detailed debugging information
- **INFO** - General information
- **WARN** - Warning messages
- **ERROR** - Error messages

### Database Debugging
```bash
# Open Drizzle Studio
bun run db:studio

# Check database schema
bun run db:check
```
