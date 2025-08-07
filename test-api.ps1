# API Test Script for SwordSkills with Subskills Support (PowerShell)
# Make sure to update the API_KEY variable with your actual API key

$API_KEY = "your-secure-api-key-here"
$BASE_URL = "http://localhost:3000"

Write-Host "=== SwordSkills API Test with Subskills ===" -ForegroundColor Green
Write-Host "Testing endpoints with API key authentication and subskills support..." -ForegroundColor Yellow
Write-Host ""

# Health check (no auth required)
Write-Host "1. Health Check:" -ForegroundColor Cyan
$response = Invoke-RestMethod -Uri "$BASE_URL/health" -Method Get
$response | ConvertTo-Json -Depth 10
Write-Host ""

# Get all skills (should only show top-level skills)
Write-Host "2. Get Skills (paginated, top-level only):" -ForegroundColor Cyan
$headers = @{ "X-API-Key" = $API_KEY }
$response = Invoke-RestMethod -Uri "$BASE_URL/skills?page=1&pageSize=5" -Method Get -Headers $headers
$response | ConvertTo-Json -Depth 10
Write-Host ""

# Create new skill with subskills
Write-Host "3. Create New Skill with Subskills:" -ForegroundColor Cyan
$skillData = @{
    name = "JavaScript"
    proficiency = 85
    years = 5
    description = "Modern JavaScript development"
    tags = @("Programming", "Web Development", "Frontend")
    url = "https://developer.mozilla.org/en-US/docs/Web/JavaScript"
    subskills = @(
        @{
            name = "React"
            proficiency = 90
            years = 3
            description = "React.js library for building user interfaces"
            tags = @("Frontend", "Library")
            url = "https://reactjs.org/"
        },
        @{
            name = "Node.js"
            proficiency = 80
            years = 4
            description = "Server-side JavaScript runtime"
            tags = @("Backend", "Runtime")
            url = "https://nodejs.org/"
        },
        @{
            name = "Express.js"
            proficiency = 85
            years = 3
            description = "Web application framework for Node.js"
            tags = @("Backend", "Framework")
            url = "https://expressjs.com/"
        }
    )
} | ConvertTo-Json -Depth 3

$headers["Content-Type"] = "application/json"
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/skills" -Method Post -Headers $headers -Body $skillData
    $response | ConvertTo-Json -Depth 10
    $newSkillId = $response.id
    Write-Host "Created skill with ID: $newSkillId and $($response.subskills.Count) subskills" -ForegroundColor Green
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    $newSkillId = 1  # Fallback ID for update test
}
Write-Host ""

# Get skill by ID (should include subskills)
Write-Host "4. Get Skill by ID with Subskills (ID=$newSkillId):" -ForegroundColor Cyan
try {
    Remove-Variable -Name headers -Scope Local
    $headers = @{ "X-API-Key" = $API_KEY }
    $response = Invoke-RestMethod -Uri "$BASE_URL/skills/$newSkillId" -Method Get -Headers $headers
    $response | ConvertTo-Json -Depth 10
    Write-Host "Retrieved skill with $($response.subskills.Count) subskills" -ForegroundColor Green
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Update skill with modified subskills
Write-Host "5. Update Skill with Modified Subskills (ID=$newSkillId):" -ForegroundColor Cyan
$updateData = @{
    proficiency = 90
    years = 6
    description = "Advanced JavaScript development with modern frameworks and tools"
    subskills = @(
        @{
            # Update React (assuming it's the first subskill)
            name = "React.js"
            proficiency = 95
            years = 4
            description = "Advanced React.js with hooks, context, and performance optimization"
            tags = @("Frontend", "Library", "Advanced")
        },
        @{
            # Add new Vue.js subskill
            name = "Vue.js"
            proficiency = 75
            years = 2
            description = "Progressive JavaScript framework"
            tags = @("Frontend", "Framework")
            url = "https://vuejs.org/"
        }
        # Note: Node.js and Express.js subskills will be removed since they're not included
    )
} | ConvertTo-Json -Depth 3

$headers["Content-Type"] = "application/json"
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/skills/$newSkillId" -Method Post -Headers $headers -Body $updateData
    $response | ConvertTo-Json -Depth 10
    Write-Host "Updated skill now has $($response.subskills.Count) subskills" -ForegroundColor Green
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test validation - try to create nested subskills (should fail)
Write-Host "6. Test Validation - Nested Subskills (should fail):" -ForegroundColor Cyan
$invalidSkillData = @{
    name = "Python"
    proficiency = 80
    years = 4
    description = "Python programming language"
    subskills = @(
        @{
            name = "Django"
            proficiency = 75
            years = 2
            description = "Python web framework"
            subskills = @(  # This should cause validation error
                @{
                    name = "Django REST Framework"
                    proficiency = 70
                    years = 1
                    description = "REST API framework for Django"
                }
            )
        }
    )
} | ConvertTo-Json -Depth 4

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/skills" -Method Post -Headers $headers -Body $invalidSkillData
    Write-Host "ERROR: Validation failed - nested subskills were allowed!" -ForegroundColor Red
} catch {
    Write-Host "SUCCESS: Validation working - nested subskills rejected: $($_.Exception.Message)" -ForegroundColor Green
}
Write-Host ""

# Get skills with filters (should only return top-level skills)
Write-Host "7. Get Skills with filters (proficiency >= 80):" -ForegroundColor Cyan
Remove-Variable -Name headers -Scope Local
$headers = @{ "X-API-Key" = $API_KEY }
$response = Invoke-RestMethod -Uri "$BASE_URL/skills?proficiency=80" -Method Get -Headers $headers
$response | ConvertTo-Json -Depth 10
Write-Host ""

# Get tags
Write-Host "8. Get Tags:" -ForegroundColor Cyan
$response = Invoke-RestMethod -Uri "$BASE_URL/tags" -Method Get -Headers $headers
$response | ConvertTo-Json -Depth 10
Write-Host ""

# Get names
Write-Host "9. Get Names:" -ForegroundColor Cyan
$response = Invoke-RestMethod -Uri "$BASE_URL/names" -Method Get -Headers $headers
$response | ConvertTo-Json -Depth 10
Write-Host ""

# Delete skill (should cascade delete subskills)
Write-Host "10. Delete Skill with Subskills (ID=$newSkillId):" -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/skills/$newSkillId/delete" -Method Post -Headers $headers
    $response | ConvertTo-Json -Depth 10
    Write-Host "Deleted skill and $($response.deletedSubskills) subskills" -ForegroundColor Green
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Admin prune
Write-Host "11. Admin Prune (remove unused names/tags):" -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/admin/prune" -Method Post -Headers $headers
    $response | ConvertTo-Json -Depth 10
    Write-Host "Pruned $($response.removed.names.Count) names and $($response.removed.tags.Count) tags" -ForegroundColor Green
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test authentication failure
Write-Host "12. Test Authentication Failure (no API key):" -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/skills" -Method Get
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Expected error: $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "=== Tests Complete ===" -ForegroundColor Green
