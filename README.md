# SwordSkills API

A Dockerized Express.js microservice for personal/professional skills management with PostgreSQL database.

## Features

- **Secure API**: All endpoints require API key authentication via `X-API-Key` header
- **CORS & Helmet**: Configured for secure public access
- **PostgreSQL Database**: Normalized schema with skills, names, and tags
- **Pagination**: All list endpoints support pagination
- **Filtering**: Skills can be filtered by proficiency, years, and tags
- **Docker Compose**: Easy deployment with PostgreSQL included

## Quick Start

1. **Clone and setup**:
   ```bash
   git clone <repository>
   cd SwordSkills
   ```

2. **Configure environment**:
   - Copy `.env` and update `API_KEY` with a secure value
   - Update database credentials if needed

3. **Run with Docker Compose**:
   ```bash
   docker-compose up --build
   ```

4. **Test the API**:
   ```bash
   curl -H "X-API-Key: your-secure-api-key-here" http://localhost:3000/skills
   ```

## API Endpoints

All endpoints require the `X-API-Key` header with a valid API key.

### Skills Management

- **GET /skills** - Get paginated skills
  - Query params: `page`, `pageSize`, `proficiency`, `years`, `tags`
  - Example: `/skills?page=1&pageSize=5&proficiency=7&tags=Programming`

- **GET /skills/:id** - Get skill by ID

- **POST /skills** - Create new skill
  ```json
  {
    "name": "React",
    "proficiency": 8,
    "years": 3,
    "description": "Frontend library for building UIs",
    "tags": ["Programming", "Frontend"]
  }
  ```

- **POST /skills/:id** - Update skill (partial updates supported)

- **POST /skills/:id/delete** - Delete skill

### Data Management

- **GET /tags** - Get paginated tags
  - Query params: `page`, `pageSize`

- **GET /names** - Get paginated skill names
  - Query params: `page`, `pageSize`

- **POST /admin/prune** - Remove unused names and tags

### Health Check

- **GET /health** - Health check

## Database Schema

```sql
-- Skill names (normalized)
CREATE TABLE names (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL
);

-- Tags for categorization
CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  tag VARCHAR(255) UNIQUE NOT NULL
);

-- Skills with references to names
CREATE TABLE skills (
  id SERIAL PRIMARY KEY,
  name_id INTEGER REFERENCES names(id) ON DELETE RESTRICT,
  proficiency INTEGER NOT NULL,  -- 1-10 scale
  years INTEGER,                 -- Years of experience
  icon VARCHAR(255),            -- Icon URL/path
  image VARCHAR(255),           -- Image URL/path
  description TEXT,             -- Detailed description
  url VARCHAR(255)              -- Related URL
);

-- Many-to-many relationship for skill tags
CREATE TABLE skill_tags (
  skill_id INTEGER REFERENCES skills(id) ON DELETE CASCADE,
  tag_id INTEGER REFERENCES tags(id) ON DELETE RESTRICT,
  PRIMARY KEY (skill_id, tag_id)
);
```

## Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run PostgreSQL** (via Docker):
   ```bash
   docker run --name postgres-skills -e POSTGRES_DB=swordskills -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:15
   ```

3. **Initialize database**:
   ```bash
   psql -h localhost -U postgres -d swordskills -f init.sql
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

## Configuration

Environment variables (`.env`):

- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3000)
- `DB_HOST` - PostgreSQL host
- `DB_PORT` - PostgreSQL port (default: 5432)
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `API_KEY` - Required API key for authentication

## Security Features

- **API Key Authentication**: All endpoints require valid API key
- **Helmet**: Security headers for common vulnerabilities
- **CORS**: Configurable cross-origin requests
- **Input Validation**: Request validation and sanitization
- **SQL Injection Protection**: Parameterized queries

## Docker Deployment

The application includes a complete Docker setup:

- **Multi-stage build** for optimized production images
- **PostgreSQL service** with data persistence
- **Environment configuration** for different environments
- **Health checks** for container monitoring

Production deployment:
```bash
docker-compose -f docker-compose.yml up -d
```

## API Usage Examples

### Create a new skill
```bash
curl -X POST http://localhost:3000/skills \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secure-api-key-here" \
  -d '{
    "name": "TypeScript",
    "proficiency": 9,
    "years": 4,
    "description": "Strongly typed JavaScript superset",
    "tags": ["Programming", "Web Development"],
    "url": "https://www.typescriptlang.org/"
  }'
```

### Get filtered skills
```bash
curl -H "X-API-Key: your-secure-api-key-here" \
  "http://localhost:3000/skills?proficiency=8&tags=Programming&page=1&pageSize=10"
```

### Update a skill
```bash
curl -X POST http://localhost:3000/skills/1 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secure-api-key-here" \
  -d '{
    "proficiency": 9,
    "years": 5
  }'
```

## License

MIT
