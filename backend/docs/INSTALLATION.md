# Installation Guide - Smart Library Automation System

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v16.x or higher ([Download](https://nodejs.org/))
- **MySQL**: v8.0 or higher ([Download](https://dev.mysql.com/downloads/))
- **Git**: For version control ([Download](https://git-scm.com/))

---

## Step 1: Install Dependencies

Open a terminal in the project directory and run:

```powershell
npm install
```

This will install all required packages:
- express
- mysql2
- jsonwebtoken
- bcryptjs
- dotenv
- cors
- helmet
- express-rate-limit
- express-validator

---

## Step 2: Configure Environment Variables

The `.env` file is already created with default values. You need to update the database credentials:

1. Open `.env` in VS Code
2. Update the following fields:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=YOUR_MYSQL_PASSWORD
DB_NAME=smart_library
```

3. Update library geolocation (use your actual library coordinates):

```env
LIBRARY_LATITUDE=37.7749
LIBRARY_LONGITUDE=-122.4194
```

4. Change the JWT secret (IMPORTANT for production):

```env
JWT_SECRET=your_unique_secret_key_here
```

---

## Step 3: Start MySQL Server

Ensure MySQL is running:

**Windows:**
```powershell
# Check if MySQL is running
Get-Service -Name MySQL*

# Start MySQL if not running
Start-Service -Name MySQL80
```

**Verify connection:**
```powershell
mysql -u root -p
```

---

## Step 4: Create Database and Tables

Run the database setup script:

```powershell
node database/setup.js
```

This will:
1. Create the `smart_library` database
2. Create all tables with proper relationships
3. Insert sample test data
4. Verify the setup

**Expected Output:**
```
============================================================
  Database Setup
============================================================
✓ Connected to MySQL server

Executing schema.sql...
✓ Schema created successfully

Executing seed.sql...
✓ Sample data inserted successfully

Verifying database setup...
  - Users: 8
  - Books: 25
  - Shelves: 15

============================================================
  ✓ Database setup completed successfully!
============================================================
```

---

## Step 5: Start the Server

### Development Mode (with auto-reload):
```powershell
npm run dev
```

### Production Mode:
```powershell
npm start
```

**Expected Output:**
```
============================================================
  Smart Library Automation System
============================================================
  Environment: development
  Mode: DEMO (Handheld Reader)
  Server: http://localhost:3000
  Health: http://localhost:3000/health
  API: http://localhost:3000/api/v1
============================================================
✓ Database connected successfully
```

---

## Step 6: Test the API

### Option 1: Browser

Open your browser and go to:
```
http://localhost:3000/health
```

You should see:
```json
{
  "status": "OK",
  "timestamp": "2026-02-05T14:30:00.000Z",
  "mode": "DEMO",
  "environment": "development"
}
```

### Option 2: PowerShell (curl)

```powershell
# Test health endpoint
Invoke-RestMethod -Uri http://localhost:3000/health -Method Get

# Register a new user
$body = @{
    email = "test@university.edu"
    password = "password123"
    firstName = "Test"
    lastName = "User"
    role = "student"
    studentId = "STU999"
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3000/api/v1/auth/register -Method Post -Body $body -ContentType "application/json"

# Login
$loginBody = @{
    email = "test@university.edu"
    password = "password123"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri http://localhost:3000/api/v1/auth/login -Method Post -Body $loginBody -ContentType "application/json"

# Extract token
$token = $response.token
Write-Host "Token: $token"

# Test authenticated endpoint
$headers = @{
    "Authorization" = "Bearer $token"
}

Invoke-RestMethod -Uri http://localhost:3000/api/v1/users/profile -Method Get -Headers $headers
```

---

## Troubleshooting

### Error: "Database connection failed"

**Cause:** MySQL not running or incorrect credentials

**Solution:**
1. Check if MySQL is running:
   ```powershell
   Get-Service -Name MySQL*
   ```
2. Verify credentials in `.env`
3. Test connection manually:
   ```powershell
   mysql -u root -p
   ```

---

### Error: "Port 3000 already in use"

**Cause:** Another application is using port 3000

**Solution 1:** Change port in `.env`:
```env
PORT=3001
```

**Solution 2:** Kill the process using port 3000:
```powershell
# Find process
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess

# Kill process
Stop-Process -Id <PID> -Force
```

---

### Error: "Cannot find module 'express'"

**Cause:** Dependencies not installed

**Solution:**
```powershell
npm install
```

---

### Error: "Access denied for user 'root'@'localhost'"

**Cause:** Incorrect MySQL password

**Solution:**
1. Reset MySQL password
2. Update `.env` with correct password

---

## Verify Installation Checklist

- [ ] Node.js installed (check: `node --version`)
- [ ] MySQL installed and running
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` configured with correct database credentials
- [ ] Database setup script executed successfully
- [ ] Server starts without errors
- [ ] Health endpoint returns "OK"
- [ ] Can register and login users

---

## Next Steps

1. **Explore the API**: Check `docs/API_CONTRACTS.md`
2. **Test RFID Scanning**: Use the `/api/v1/rfid/scan` endpoint
3. **Test Entry Logging**: Use the `/api/v1/entry/log` endpoint
4. **Search Books**: Use the `/api/v1/books/search` endpoint

---

## Sample Test Credentials

Pre-loaded test users (password: `password123`):

| Email | Role | Purpose |
|-------|------|---------|
| admin@library.edu | admin | Full system access |
| librarian1@library.edu | librarian | Book scanning, inventory |
| student1@university.edu | student | Book search, entry logging |

---

## Mode Switching

To switch between DEMO and PRODUCTION modes:

1. Edit `.env`:
   ```env
   DEMO_MODE=false  # For production mode
   ```

2. Restart the server

**DEMO MODE:**
- Handheld RFID reader
- Manual shelf selection
- Test data shows 1 handheld reader

**PRODUCTION MODE:**
- Fixed RFID readers at each shelf
- Automatic shelf detection
- Test data shows 15 fixed readers

---

## Development Workflow

1. Make code changes
2. Server auto-reloads (if using `npm run dev`)
3. Test endpoints with Postman or curl
4. Check logs in terminal
5. Commit changes to Git

---

## Production Deployment

For production deployment:

1. Set environment to production:
   ```env
   NODE_ENV=production
   ```

2. Use a strong JWT secret:
   ```env
   JWT_SECRET=<generate-strong-random-key>
   ```

3. Use a process manager (PM2):
   ```powershell
   npm install -g pm2
   pm2 start src/app.js --name library-api
   pm2 save
   ```

4. Set up reverse proxy (Nginx/Apache)
5. Enable HTTPS
6. Configure firewall
7. Set up database backups

---

## Getting Help

- **API Documentation**: See `docs/API_CONTRACTS.md`
- **Algorithms**: See `docs/ALGORITHMS.md`
- **Database Schema**: See `database/schema.sql`

---

**Installation complete! Your Smart Library Automation System is ready to use.**
