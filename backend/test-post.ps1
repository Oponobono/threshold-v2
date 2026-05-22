$headers = @{
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiZW1haWwiOiJ1c2VyIiwiaWF0IjoxNzc5NDUwOTQ5LCJleHAiOjE3ODIwNDI5NDl9.WK9uC59No-1b9Zb9m0XfXefoJjKdyX_a4OcvZ4UQt9k"
    "Content-Type" = "application/json"
}

$body = @{
    subject_id = 8
    name = "Test Nota 3"
    type = "note"
    date = "2024-05-22"
    weight = "10"
    out_of = 100
    score = 88
    percentage = 88
    grade_value = 4.0
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://localhost:3000/api/assessments" `
    -Headers $headers `
    -Method Post `
    -Body $body `
    -ContentType "application/json" `
    -ErrorAction SilentlyContinue

Write-Host "Status Code: $($response.StatusCode)"
Write-Host "Response Body:"
$response.Content | ConvertFrom-Json | ConvertTo-Json
