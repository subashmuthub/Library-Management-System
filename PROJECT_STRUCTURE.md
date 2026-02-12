# Smart Library System - Project Structure

## Overview
This project is organized into **separate frontend and backend** folders for clean architecture.

```
d:\library\
│
├── 📁 BACKEND (Node.js + Express + MySQL)
│   ├── src/                      # Backend source code
│   │   ├── config/              # Database & mode configuration
│   │   ├── controllers/         # Business logic (8 files)
│   │   ├── middleware/          # Auth & validation
│   │   ├── routes/              # API endpoints (8 files)
│   │   ├── services/            # Core algorithms
│   │   ├── utils/               # Helper functions
│   │   └── app.js               # Express server entry
│   │
│   ├── database/                # Database scripts
│   │   ├── schema.sql           # Table definitions
│   │   ├── seed.sql             # Sample data
│   │   └── setup.js             # Automated setup
│   │
│   ├── tests/                   # API tests
│   │   └── api-test.js          # Automated test suite
│   │
│   ├── docs/                    # Documentation (7 files)
│   │   ├── API_CONTRACTS.md     # API documentation
│   │   ├── ALGORITHMS.md        # Technical details
│   │   ├── ARCHITECTURE_DIAGRAM.md
│   │   ├── DEPLOYMENT.md        # Production guide
│   │   ├── INSTALLATION.md      # Setup instructions
│   │   ├── TESTING_GUIDE.md     # Test procedures
│   │   └── README.md            # Docs index
│   │
│   ├── package.json             # Backend dependencies
│   ├── .env                     # Backend environment
│   ├── .env.example             # Backend env template
│   └── .gitignore               # Backend ignore rules
│
├── 📁 FRONTEND (React + Vite + Tailwind)
│   ├── src/                     # Frontend source code
│   │   ├── components/          # Reusable UI components
│   │   │   ├── Layout.jsx       # Main app layout
│   │   │   └── PrivateRoute.jsx # Auth guard
│   │   │
│   │   ├── contexts/            # React Context providers
│   │   │   ├── AuthContext.jsx  # Authentication state
│   │   │   ├── ModeContext.jsx  # DEMO/PRODUCTION mode
│   │   │   └── index.js         # Context exports
│   │   │
│   │   ├── pages/               # Application pages
│   │   │   ├── Login.jsx        # Login page
│   │   │   ├── Register.jsx     # Registration page
│   │   │   ├── Dashboard.jsx    # Home dashboard
│   │   │   ├── Books.jsx        # Book search/list
│   │   │   ├── BookDetails.jsx  # Single book view
│   │   │   ├── EntryLog.jsx     # GPS entry logging
│   │   │   ├── RFIDScanner.jsx  # RFID scanning
│   │   │   ├── Navigation.jsx   # Indoor navigation
│   │   │   └── Profile.jsx      # User profile
│   │   │
│   │   ├── services/            # API integration
│   │   │   ├── api.js           # Axios instance
│   │   │   └── index.js         # API endpoints
│   │   │
│   │   ├── App.jsx              # Main app with routing
│   │   ├── main.jsx             # React entry point
│   │   └── index.css            # Global styles
│   │
│   ├── public/                  # Static assets
│   ├── package.json             # Frontend dependencies
│   ├── vite.config.js           # Vite configuration
│   ├── tailwind.config.js       # Tailwind config
│   ├── postcss.config.js        # PostCSS config
│   ├── .env                     # Frontend environment
│   ├── .env.example             # Frontend env template
│   ├── .gitignore               # Frontend ignore rules
│   └── README.md                # Frontend guide
│
├── 📄 ROOT DOCUMENTATION
│   ├── README.md                # Project overview
│   ├── PROJECT_SUMMARY.md       # Feature summary
│   ├── COMPLETE_GUIDE.md        # Full setup guide
│   ├── PROJECT_STRUCTURE.md     # This file
│   └── quickstart.ps1           # Quick start script
│
└── .gitignore                   # Root ignore rules
```

## Folder Separation

### ✅ Backend Folder (`/`)
- **Location:** Root directory
- **Purpose:** API server, database, business logic
- **Port:** 3000
- **Technology:** Node.js + Express + MySQL

### ✅ Frontend Folder (`/frontend`)
- **Location:** `/frontend` subdirectory
- **Purpose:** User interface, client-side logic
- **Port:** 3001 (or 3002 if 3001 is busy)
- **Technology:** React + Vite + Tailwind CSS

## Key Files

### Backend Entry Points
- `src/app.js` - Express server
- `database/setup.js` - Database initialization
- `tests/api-test.js` - API testing

### Frontend Entry Points
- `src/main.jsx` - React entry
- `src/App.jsx` - Router setup
- `index.html` - HTML template

### Configuration Files
- **Backend:** `.env`, `package.json`
- **Frontend:** `frontend/.env`, `frontend/package.json`

## Running the Project

### 1. Start Backend
```powershell
cd d:\library
npm install          # Install dependencies (first time)
npm run dev          # Start server on port 3000
```

### 2. Start Frontend
```powershell
cd d:\library\frontend
npm install          # Install dependencies (first time)
npm run dev          # Start dev server on port 3001
```

### 3. Access Application
- **Frontend:** http://localhost:3001 (or 3002)
- **Backend API:** http://localhost:3000
- **API Health:** http://localhost:3000/health

## Environment Variables

### Backend (.env)
```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=smart_library
JWT_SECRET=change_this_in_production
DEMO_MODE=true
```

### Frontend (frontend/.env)
```env
VITE_API_URL=http://localhost:3000/api/v1
VITE_DEMO_MODE=true
VITE_LIBRARY_LATITUDE=37.7749
VITE_LIBRARY_LONGITUDE=-122.4194
```

## File Counts

- **Backend Files:** 37 files
  - Source code: 15 files
  - Database: 3 files
  - Documentation: 7 files
  - Config: 12 files

- **Frontend Files:** 26 files
  - Components: 2 files
  - Pages: 8 files
  - Contexts: 3 files
  - Services: 2 files
  - Config: 11 files

- **Total:** 63 files

## Dependencies

### Backend (Node.js)
- express, mysql2, jsonwebtoken, bcryptjs
- cors, helmet, express-rate-limit
- express-validator, dotenv
- nodemon (dev), jest (testing)

### Frontend (React)
- react, react-dom, react-router-dom
- axios, date-fns, lucide-react
- vite, tailwindcss, postcss, autoprefixer

## Database Structure

**8 Tables:**
1. `users` - User accounts
2. `entry_logs` - GPS entry/exit records
3. `books` - Book catalog
4. `rfid_tags` - RFID tag mappings
5. `shelves` - Shelf locations
6. `readers` - RFID reader devices
7. `beacons` - BLE beacon locations
8. `book_location_history` - Book movement tracking

## API Endpoints

**8 Route Groups:**
1. `/api/v1/auth` - Authentication (login, register)
2. `/api/v1/users` - User management
3. `/api/v1/entry` - Entry logging
4. `/api/v1/books` - Book search & details
5. `/api/v1/rfid` - RFID scanning
6. `/api/v1/shelves` - Shelf management
7. `/api/v1/beacons` - Beacon locations
8. `/api/v1/navigation` - Indoor navigation

**Total Endpoints:** 30+

## Mode Switching

### DEMO Mode (Handheld RFID)
- Backend: `DEMO_MODE=true`
- Frontend: `VITE_DEMO_MODE=true`
- Feature: Manual shelf selection

### PRODUCTION Mode (Fixed RFID)
- Backend: `DEMO_MODE=false`
- Frontend: `VITE_DEMO_MODE=false`
- Feature: Automatic location detection

## Documentation

- **Backend:** `/docs/` folder (7 markdown files)
- **Frontend:** `/frontend/README.md`
- **Complete:** `/COMPLETE_GUIDE.md`
- **API:** `/docs/API_CONTRACTS.md`

## Testing

### Backend Testing
```powershell
cd d:\library
node tests/api-test.js
```

### Frontend Testing
- Open browser: http://localhost:3001
- Use demo credentials:
  - alice@example.com / password123
  - carol@example.com / password123

## Common Issues

### Port Already in Use
- Backend: Change `PORT` in `.env`
- Frontend: Vite auto-increments (3001 → 3002 → 3003)

### Database Connection Failed
- Check MySQL is running: `net start MySQL80`
- Verify `DB_PASSWORD` in `.env`

### CORS Errors
- Ensure backend is running first
- Check `VITE_API_URL` matches backend port

## Production Deployment

### Build Frontend
```powershell
cd d:\library\frontend
npm run build
# Output: dist/ folder
```

### Run Backend in Production
```powershell
cd d:\library
npm start
# Or use PM2: pm2 start src/app.js
```

## Git Workflow

Both frontend and backend have separate `.gitignore` files:
- **Backend:** Ignores `node_modules/`, `.env`, logs
- **Frontend:** Ignores `node_modules/`, `.env`, `dist/`

## Support

For detailed guides:
- Setup: `/COMPLETE_GUIDE.md`
- Frontend: `/frontend/README.md`
- API: `/docs/API_CONTRACTS.md`
- Deployment: `/docs/DEPLOYMENT.md`

---

**Last Updated:** February 5, 2026  
**Status:** ✅ Production Ready
