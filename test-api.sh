#!/bin/bash

# API Test Script for SwordSkills with Subskills Support
# Make sure to update the API_KEY variable with your actual API key

API_KEY="your-secure-api-key-here"
BASE_URL="http://localhost:3000"

echo "=== SwordSkills API Test with Subskills ==="
echo "Testing endpoints with API key authentication and subskills support..."
echo ""

# Health check (no auth required)
echo "1. Health Check:"
curl -s "$BASE_URL/health" | jq . || echo "jq not installed, raw response above"
echo ""

# Get all skills (should only show top-level skills)
echo "2. Get Skills (paginated, top-level only):"
curl -s -H "X-API-Key: $API_KEY" "$BASE_URL/skills?page=1&pageSize=5" | jq . || echo "jq not installed, raw response above"
echo ""

# Create new skill with subskills
echo "3. Create New Skill with Subskills:"
curl -s -X POST "$BASE_URL/skills" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "name": "JavaScript",
    "proficiency": 85,
    "years": 5,
    "description": "Modern JavaScript development",
    "tags": ["Programming", "Web Development", "Frontend"],
    "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
    "subskills": [
      {
        "name": "React",
        "proficiency": 90,
        "years": 3,
        "description": "React.js library for building user interfaces",
        "tags": ["Frontend", "Library"],
        "url": "https://reactjs.org/"
      },
      {
        "name": "Node.js",
        "proficiency": 80,
        "years": 4,
        "description": "Server-side JavaScript runtime",
        "tags": ["Backend", "Runtime"],
        "url": "https://nodejs.org/"
      },
      {
        "name": "Express.js",
        "proficiency": 85,
        "years": 3,
        "description": "Web application framework for Node.js",
        "tags": ["Backend", "Framework"],
        "url": "https://expressjs.com/"
      }
    ]
  }' | jq . || echo "jq not installed, raw response above"

# Extract the skill ID for subsequent tests (requires jq)
SKILL_ID=$(curl -s -H "X-API-Key: $API_KEY" "$BASE_URL/skills?page=1&pageSize=1" | jq -r '.data[0].id // 1')
echo "Using skill ID: $SKILL_ID"
echo ""

# Get skill by ID (should include subskills)
echo "4. Get Skill by ID with Subskills (ID=$SKILL_ID):"
curl -s -H "X-API-Key: $API_KEY" "$BASE_URL/skills/$SKILL_ID" | jq . || echo "jq not installed, raw response above"
echo ""

# Update skill with modified subskills
echo "5. Update Skill with Modified Subskills (ID=$SKILL_ID):"
curl -s -X POST "$BASE_URL/skills/$SKILL_ID" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "proficiency": 90,
    "years": 6,
    "description": "Advanced JavaScript development with modern frameworks and tools",
    "subskills": [
      {
        "name": "React.js",
        "proficiency": 95,
        "years": 4,
        "description": "Advanced React.js with hooks, context, and performance optimization",
        "tags": ["Frontend", "Library", "Advanced"]
      },
      {
        "name": "Vue.js",
        "proficiency": 75,
        "years": 2,
        "description": "Progressive JavaScript framework",
        "tags": ["Frontend", "Framework"],
        "url": "https://vuejs.org/"
      }
    ]
  }' | jq . || echo "jq not installed, raw response above"
echo ""

# Test validation - try to create nested subskills (should fail)
echo "6. Test Validation - Nested Subskills (should fail):"
curl -s -X POST "$BASE_URL/skills" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "name": "Python",
    "proficiency": 80,
    "years": 4,
    "description": "Python programming language",
    "subskills": [
      {
        "name": "Django",
        "proficiency": 75,
        "years": 2,
        "description": "Python web framework",
        "subskills": [
          {
            "name": "Django REST Framework",
            "proficiency": 70,
            "years": 1,
            "description": "REST API framework for Django"
          }
        ]
      }
    ]
  }' | jq . || echo "jq not installed, raw response above"
echo ""

# Get skills with filters (should only return top-level skills)
echo "7. Get Skills with filters (proficiency >= 80):"
curl -s -H "X-API-Key: $API_KEY" "$BASE_URL/skills?proficiency=80" | jq . || echo "jq not installed, raw response above"
echo ""

# Get tags
echo "8. Get Tags:"
curl -s -H "X-API-Key: $API_KEY" "$BASE_URL/tags" | jq . || echo "jq not installed, raw response above"
echo ""

# Get names
echo "9. Get Names:"
curl -s -H "X-API-Key: $API_KEY" "$BASE_URL/names" | jq . || echo "jq not installed, raw response above"
echo ""

# Delete skill (should cascade delete subskills)
echo "10. Delete Skill with Subskills (ID=$SKILL_ID):"
curl -s -X POST "$BASE_URL/skills/$SKILL_ID/delete" \
  -H "X-API-Key: $API_KEY" | jq . || echo "jq not installed, raw response above"
echo ""

# Admin prune
echo "11. Admin Prune (remove unused names/tags):"
curl -s -X POST "$BASE_URL/admin/prune" \
  -H "X-API-Key: $API_KEY" | jq . || echo "jq not installed, raw response above"
echo ""

# Test authentication failure
echo "12. Test Authentication Failure (no API key):"
curl -s "$BASE_URL/skills" | jq . || echo "jq not installed, raw response above"
echo ""

echo "=== Tests Complete ==="
