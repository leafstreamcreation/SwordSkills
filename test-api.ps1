# API Test Script for SwordSkills (PowerShell)
# Make sure to update the API_KEY variable with your actual API key

$API_KEY = "your-secure-api-key-here"
$BASE_URL = "http://localhost:3000"

Write-Host "=== SwordSkills API Test ===" -ForegroundColor Green
Write-Host "Testing endpoints with API key authentication..." -ForegroundColor Yellow
Write-Host ""

# Health check (no auth required)
Write-Host "1. Health Check:" -ForegroundColor Cyan
$response = Invoke-RestMethod -Uri "$BASE_URL/health" -Method Get
$response | ConvertTo-Json -Depth 10
Write-Host ""

# Get all skills
Write-Host "2. Get Skills (paginated):" -ForegroundColor Cyan
$headers = @{ "X-API-Key" = $API_KEY }
$response = Invoke-RestMethod -Uri "$BASE_URL/skills?page=1&pageSize=5" -Method Get -Headers $headers
$response | ConvertTo-Json -Depth 10
Write-Host ""

# Get skills with filters
Write-Host "3. Get Skills with filters:" -ForegroundColor Cyan
$response = Invoke-RestMethod -Uri "$BASE_URL/skills?proficiency=7&tags=Programming" -Method Get -Headers $headers
$response | ConvertTo-Json -Depth 10
Write-Host ""

# Get skill by ID
Write-Host "4. Get Skill by ID (ID=1):" -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/skills/1" -Method Get -Headers $headers
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Create new skill
Write-Host "5. Create New Skill:" -ForegroundColor Cyan
$skillData = @{
    name = "React"
    proficiency = 8
    years = 3
    description = "Frontend library for building user interfaces"
    tags = @("Programming", "Frontend", "Web Development")
    url = "https://reactjs.org/"
} | ConvertTo-Json

$headers["Content-Type"] = "application/json"
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/skills" -Method Post -Headers $headers -Body $skillData
    $response | ConvertTo-Json -Depth 10
    $newSkillId = $response.id
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    $newSkillId = 6  # Fallback ID for update test
}
Write-Host ""

# Update skill
Write-Host "6. Update Skill (ID=$newSkillId):" -ForegroundColor Cyan
$updateData = @{
    proficiency = 9
    years = 4
    description = "Advanced React development with hooks and context"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/skills/$newSkillId" -Method Post -Headers $headers -Body $updateData
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Get tags
Write-Host "7. Get Tags:" -ForegroundColor Cyan
Remove-Variable -Name headers -Scope Local
$headers = @{ "X-API-Key" = $API_KEY }
$response = Invoke-RestMethod -Uri "$BASE_URL/tags" -Method Get -Headers $headers
$response | ConvertTo-Json -Depth 10
Write-Host ""

# Get names
Write-Host "8. Get Names:" -ForegroundColor Cyan
$response = Invoke-RestMethod -Uri "$BASE_URL/names" -Method Get -Headers $headers
$response | ConvertTo-Json -Depth 10
Write-Host ""

# Test authentication failure
Write-Host "9. Test Authentication Failure (no API key):" -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/skills" -Method Get
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Expected error: $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "=== Tests Complete ===" -ForegroundColor Green
