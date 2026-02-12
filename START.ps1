# Smart Library System - Quick Start Script
# Run this after fixing your MySQL password

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Smart Library System - Quick Start" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (!(Test-Path ".\env")) {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    Write-Host "Please create .env file with your MySQL password" -ForegroundColor Yellow
    Write-Host "Copy from .env.example and update DB_PASSWORD" -ForegroundColor Yellow
    exit 1
}

# Step 1: Install Backend Dependencies
Write-Host "Step 1: Installing backend dependencies..." -ForegroundColor Yellow
if (!(Test-Path ".\node_modules")) {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install backend dependencies" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Backend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✅ Backend dependencies already installed" -ForegroundColor Green
}

# Step 2: Install Frontend Dependencies
Write-Host ""
Write-Host "Step 2: Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location frontend
if (!(Test-Path ".\node_modules")) {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install frontend dependencies" -ForegroundColor Red
        Set-Location ..
        exit 1
    }
    Write-Host "✅ Frontend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✅ Frontend dependencies already installed" -ForegroundColor Green
}
Set-Location ..

# Step 3: Setup Database
Write-Host ""
Write-Host "Step 3: Setting up database..." -ForegroundColor Yellow
Write-Host "Make sure MySQL is running and password is correct in .env" -ForegroundColor Cyan
$setupDB = Read-Host "Do you want to setup database now? (y/n)"
if ($setupDB -eq 'y') {
    node database/setup.js
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Database setup failed" -ForegroundColor Red
        Write-Host "Please check your MySQL connection and password in .env" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✅ Database setup complete" -ForegroundColor Green
}

# Step 4: Start Servers
Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To start the application:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Start Backend (in one terminal):" -ForegroundColor Cyan
Write-Host "   cd d:\library" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "2. Start Frontend (in another terminal):" -ForegroundColor Cyan
Write-Host "   cd d:\library\frontend" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "3. Open browser:" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:3001" -ForegroundColor White
Write-Host "   Backend:  http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "Demo Login:" -ForegroundColor Cyan
Write-Host "   Email: alice@example.com" -ForegroundColor White
Write-Host "   Password: password123" -ForegroundColor White
Write-Host ""
Write-Host "Need help? Check COMPLETE_GUIDE.md" -ForegroundColor Yellow
Write-Host ""
