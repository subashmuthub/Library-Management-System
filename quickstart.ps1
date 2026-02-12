# Smart Library Quick Start Script
# Run this after installing Node.js and MySQL

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Smart Library Automation System - Quick Start" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check Node.js
Write-Host "Step 1: Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js installed: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found. Please install from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Step 2: Check MySQL
Write-Host ""
Write-Host "Step 2: Checking MySQL installation..." -ForegroundColor Yellow
$mysqlService = Get-Service -Name "MySQL*" -ErrorAction SilentlyContinue
if ($mysqlService) {
    if ($mysqlService.Status -eq 'Running') {
        Write-Host "✓ MySQL is running" -ForegroundColor Green
    } else {
        Write-Host "⚠ MySQL is installed but not running. Starting..." -ForegroundColor Yellow
        Start-Service -Name $mysqlService.Name
        Write-Host "✓ MySQL started" -ForegroundColor Green
    }
} else {
    Write-Host "✗ MySQL not found. Please install from https://dev.mysql.com/downloads/" -ForegroundColor Red
    exit 1
}

# Step 3: Install npm dependencies
Write-Host ""
Write-Host "Step 3: Installing npm dependencies..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "✗ npm install failed" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✗ package.json not found. Are you in the project directory?" -ForegroundColor Red
    exit 1
}

# Step 4: Check .env file
Write-Host ""
Write-Host "Step 4: Checking configuration..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "✓ .env file exists" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠ IMPORTANT: Please verify your database credentials in .env:" -ForegroundColor Yellow
    Write-Host "  DB_HOST=localhost" -ForegroundColor White
    Write-Host "  DB_USER=root" -ForegroundColor White
    Write-Host "  DB_PASSWORD=YOUR_PASSWORD_HERE" -ForegroundColor White
    Write-Host ""
    $continue = Read-Host "Have you configured .env? (y/n)"
    if ($continue -ne 'y') {
        Write-Host "Please edit .env and run this script again." -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "⚠ .env file not found. Creating from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✓ .env created" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠ Please edit .env and set your database password, then run this script again." -ForegroundColor Yellow
    exit 0
}

# Step 5: Set up database
Write-Host ""
Write-Host "Step 5: Setting up database..." -ForegroundColor Yellow
node database/setup.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Database setup complete" -ForegroundColor Green
} else {
    Write-Host "✗ Database setup failed. Check your MySQL credentials in .env" -ForegroundColor Red
    exit 1
}

# Step 6: Success message
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  ✓ Setup Complete!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your Smart Library system is ready!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Start the server:" -ForegroundColor White
Write-Host "     npm run dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "  2. Test the API:" -ForegroundColor White
Write-Host "     node tests/api-test.js" -ForegroundColor Cyan
Write-Host ""
Write-Host "  3. View documentation:" -ForegroundColor White
Write-Host "     docs/API_CONTRACTS.md" -ForegroundColor Cyan
Write-Host "     docs/INSTALLATION.md" -ForegroundColor Cyan
Write-Host "     PROJECT_SUMMARY.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "  4. Access the API:" -ForegroundColor White
Write-Host "     http://localhost:3000/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
