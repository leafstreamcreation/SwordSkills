#!/bin/bash

# API Test Script for SwordSkills
# Make sure to update the API_KEY variable with your actual API key

API_KEY="your-secure-api-key-here"
BASE_URL="http://localhost:3000"

echo "=== SwordSkills API Test ==="
echo "Testing endpoints with API key authentication..."
echo ""

# Health check (no auth required)
echo "1. Health Check:"
curl -s "$BASE_URL/health" | jq .
echo ""

# Get all skills
echo "2. Get Skills (paginated):"
curl -s -H "X-API-Key: $API_KEY" "$BASE_URL/skills?page=1&pageSize=5" | jq .
echo ""

# Get skills with filters
echo "3. Get Skills with filters:"
curl -s -H "X-API-Key: $API_KEY" "$BASE_URL/skills?proficiency=7&tags=Programming" | jq .
echo ""

# Get skill by ID
echo "4. Get Skill by ID (ID=1):"
curl -s -H "X-API-Key: $API_KEY" "$BASE_URL/skills/1" | jq .
echo ""

# Create new skill
echo "5. Create New Skill:"
curl -s -X POST "$BASE_URL/skills" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "name": "React",
    "proficiency": 8,
    "years": 3,
    "description": "Frontend library for building user interfaces",
    "tags": ["Programming", "Frontend", "Web Development"],
    "url": "https://reactjs.org/"
  }' | jq .
echo ""

# Update skill (assuming the created skill has ID 6)
echo "6. Update Skill (ID=6):"
curl -s -X POST "$BASE_URL/skills/6" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "proficiency": 9,
    "years": 4,
    "description": "Advanced React development with hooks and context"
  }' | jq .
echo ""

# Get tags
echo "7. Get Tags:"
curl -s -H "X-API-Key: $API_KEY" "$BASE_URL/tags" | jq .
echo ""

# Get names
echo "8. Get Names:"
curl -s -H "X-API-Key: $API_KEY" "$BASE_URL/names" | jq .
echo ""

# Test authentication failure
echo "9. Test Authentication Failure (no API key):"
curl -s "$BASE_URL/skills" | jq .
echo ""

echo "=== Tests Complete ==="
