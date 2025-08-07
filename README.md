# SwordSkills - Skills Management Microservice with Subskills Support

A Dockerized Express.js microservice for managing personal/professional skills with PostgreSQL, featuring nested subskills support, API key authentication, and secure public access.

## Features

- **RESTful API** with comprehensive CRUD operations
- **Nested Subskills Support** - Single-level nesting with validation
- **API Key Authentication** on all endpoints (X-API-Key header)
- **Pagination** for all list endpoints
- **Advanced Filtering** by proficiency, years, and tags
- **PostgreSQL Database** with normalized schema
- **Docker & Docker Compose** for easy deployment
- **Security** with CORS and Helmet middleware
- **Transaction Integrity** for all database operations

## Database Schema

### Core Tables
- **`names`** - Unique skill/subskill names
- **`tags`** - Reusable tags for categorization
- **`skills`** - Main skills and subskills with parent-child relationships
- **`skill_tags`** - Many-to-many relationship between skills and tags

### Subskills Architecture
- Skills can have subskills (parent_id references skills.id)
- Subskills cannot have their own subskills (single-level nesting only)
- Database trigger prevents multi-level nesting
- Cascade deletion ensures referential integrity

## API Endpoints

All endpoints require `X-API-Key` header authentication.

### Skills Management

#### `GET /skills`
Get paginated skills (top-level only) with optional filtering
- Query params: `page`, `pageSize`, `proficiency`, `years`, `tags`
- Returns: Skills with subskills count and full subskills data

#### `GET /skills/:id`
Get specific skill by ID with full subskills data
- Returns: Complete skill object with subskills array

#### `POST /skills`
Create new skill with optional subskills
```json
{
  "name": "JavaScript",
  "proficiency": 85,
  "years": 5,
  "description": "Modern JavaScript development",
  "tags": ["Programming", "Web Development"],
  "subskills": [
    {
      "name": "React",
      "proficiency": 90,
      "years": 3,
      "description": "React.js library",
      "tags": ["Frontend", "Library"]
    }
  ]
}
```

#### `POST /skills/:id`
Update skill and/or manage subskills
- Include `subskills` array to replace all subskills
- Existing subskills can be updated by including their `id`
- New subskills created without `id`
- Missing subskills are deleted

#### `POST /skills/:id/delete`
Delete skill and cascade delete all subskills
- Returns: Deletion confirmation with subskills count

### Utility Endpoints

#### `GET /tags`
Get paginated list of all tags

#### `GET /names`
Get paginated list of all skill names

#### `POST /admin/prune`
Remove unused names and tags from database

#### `GET /health`
Health check endpoint (no authentication required)

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
