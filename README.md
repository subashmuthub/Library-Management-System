# Smart Library Automation System

Complete full-stack library management system with GPS-based entry tracking, RFID book location, and indoor navigation.

## 🏗️ Project Structure

```
d:\library\
│
├── backend/              # Backend API (Node.js + Express + MySQL)
│   ├── src/             # Source code
│   ├── database/        # Database schemas & seeds
│   ├── docs/            # API documentation
│   ├── tests/           # Test files
│   ├── package.json     # Backend dependencies
│   └── .env             # Backend configuration
│
├── frontend/            # Frontend App (React + Vite + Tailwind)
│   ├── src/            # React components & pages
│   ├── public/         # Static assets
│   ├── package.json    # Frontend dependencies
│   └── .env            # Frontend configuration
│
└── README.md           # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- MySQL 8.0+

### 1. Setup Backend

```powershell
# Navigate to backend
cd d:\library\backend

# Install dependencies
npm install

# Configure database password in .env
notepad .env
# Update: DB_PASSWORD=your_mysql_password

# Setup database
node database\setup.js

# Start backend server
npm run dev
```

**Backend will run on:** http://localhost:3000

### 2. Setup Frontend

```powershell
# Open new terminal
cd d:\library\frontend

# Install dependencies
npm install

# Start frontend server
npm run dev
```

**Frontend will run on:** http://localhost:3001

### 3. Access Application

Open your browser: **http://localhost:3001**

**Demo Login:**
- Email: `alice@example.com`
- Password: `password123`

## 📋 Features

- ✅ **User Authentication** - JWT-based login/register
- ✅ **GPS Entry Tracking** - Hybrid confidence scoring
- ✅ **Book Search** - Full-text search with filters
- ✅ **RFID Scanning** - Mode-aware (DEMO/PRODUCTION)
- ✅ **Indoor Navigation** - BLE beacon-based wayfinding
- ✅ **Real-time Location** - Book tracking system
- ✅ **Dashboard** - Statistics and activity monitoring
- ✅ **Profile Management** - User info editing

## 🛠️ Technology Stack

### Backend
- Node.js + Express
- MySQL 8.0
- JWT Authentication

### Frontend
- React 18.2
- Vite 5.0
- Tailwind CSS 3.3

## 📖 Documentation

- **Backend API:** `backend/docs/API_CONTRACTS.md`
- **Frontend Guide:** `frontend/README.md`

## 🔧 Configuration

### Backend (.env)
```env
DB_PASSWORD=your_mysql_password
PORT=3000
DEMO_MODE=true
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3000/api/v1
```

## 🧪 Testing

```powershell
cd backend
node tests\api-test.js
```

---

**Status:** ✅ Production Ready  
**Last Updated:** February 5, 2026

- Node.js >= 16.x
- MySQL >= 8.0
- npm or yarn

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```

4. Configure `.env` with your database credentials and settings

5. Set up the database:
   ```bash
   npm run db:setup
   ```

6. Start the server:
   ```bash
   # Development mode with auto-reload
   npm run dev
   
   # Production mode
   npm start
   ```

## Configuration

### Mode Switching

The system supports two operational modes controlled by the `DEMO_MODE` flag:

- **DEMO_MODE=true**: Handheld RFID reader with manual shelf selection
- **DEMO_MODE=false**: Fixed RFID readers with automatic shelf detection

### GPS Entry Configuration

Configure entry detection thresholds in `.env`:

- `GPS_PROXIMITY_THRESHOLD`: Distance in meters (default: 50m)
- `LIBRARY_WIFI_SSID`: Library Wi-Fi network name
- `MOTION_SPEED_THRESHOLD`: Maximum walking speed in km/h (default: 5)
- `ENTRY_CONFIDENCE_AUTO_THRESHOLD`: Auto-log threshold (default: 80%)
- `ENTRY_CONFIDENCE_MANUAL_THRESHOLD`: Manual confirmation threshold (default: 50%)

## API Documentation

API documentation is available in the `docs/` folder.

Base URL: `http://localhost:3000/api/v1`

### Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Database Schema

See `database/schema.sql` for complete table definitions.

### Core Entities

- **users**: Students, librarians, admins
- **entry_logs**: Student entry/exit audit trail
- **books**: Library catalog
- **rfid_tags**: RFID tag registry
- **shelves**: Physical shelf locations
- **readers**: RFID reader hardware
- **beacons**: BLE beacon registry
- **book_location_history**: Time-series book movement data

## Project Structure

```
library/
├── src/
│   ├── config/           # Configuration management
│   ├── models/           # Database models
│   ├── controllers/      # Business logic
│   ├── routes/           # API endpoints
│   ├── middleware/       # Auth, logging, error handling
│   ├── services/         # External integrations
│   ├── utils/            # Helper functions
│   └── app.js            # Express app setup
├── database/
│   ├── schema.sql        # Table definitions
│   ├── seed.sql          # Sample test data
│   └── migrations/       # Schema version control
├── tests/                # Unit & integration tests
├── docs/                 # API documentation
└── README.md
```

## Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Security

- JWT-based authentication
- Role-based access control (Student, Librarian, Admin)
- Rate limiting (100 requests/minute per user)
- SQL injection prevention via parameterized queries
- Password hashing with bcrypt

## Hardware Integration

### RFID Readers

- **Demo Mode**: Any USB/Bluetooth handheld RFID reader
- **Production Mode**: Fixed UHF RFID readers with TCP/IP or serial interface

### BLE Beacons

- Standard iBeacon/Eddystone protocol
- Battery-powered (1-2 year life)
- 1-3 meter indoor accuracy

## Future Enhancements

- Real-time occupancy dashboard
- Predictive analytics for book demand
- Integration with library management systems
- Mobile app (iOS/Android)
- Web-based admin panel

## License

ISC

## Support

For issues and questions, please open an issue in the repository.
