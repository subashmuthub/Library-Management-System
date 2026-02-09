# Smart Library Frontend

Modern React frontend application for the Smart Library Automation System.

## Technology Stack

- **React 18.2** - Modern UI framework with hooks
- **Vite 5.0** - Fast build tool and dev server
- **React Router 6.20** - Client-side routing
- **Tailwind CSS 3.3** - Utility-first styling
- **Axios 1.6** - HTTP client for API calls
- **Lucide React** - Modern icon library
- **date-fns 3.0** - Date formatting utilities

## Features

### Core Functionality
- 🔐 **Authentication** - JWT-based login/register with role-based access
- 📚 **Book Search** - Full-text search with category filters
- 📍 **Indoor Navigation** - BLE beacon-based wayfinding
- 🏷️ **RFID Scanner** - Mode-aware tag scanning (DEMO/PRODUCTION)
- 📊 **Dashboard** - Real-time occupancy and activity tracking
- 👤 **Profile Management** - User profile editing

### UI/UX Features
- ✅ Fully responsive design (mobile, tablet, desktop)
- ✅ Modern, clean interface with Tailwind CSS
- ✅ Real-time feedback with loading states
- ✅ Error handling with user-friendly messages
- ✅ Dark mode ready (base styles prepared)

## Project Structure

```
frontend/
├── public/               # Static assets
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── Layout.jsx           # Main app layout with sidebar
│   │   └── PrivateRoute.jsx     # Protected route wrapper
│   ├── contexts/         # React Context providers
│   │   ├── AuthContext.jsx      # Authentication state
│   │   └── ModeContext.jsx      # DEMO/PRODUCTION mode
│   ├── pages/            # Main application pages
│   │   ├── Login.jsx            # Login page
│   │   ├── Register.jsx         # Registration page
│   │   ├── Dashboard.jsx        # Home dashboard
│   │   ├── Books.jsx            # Book search/list
│   │   ├── BookDetails.jsx      # Single book view
│   │   ├── EntryLog.jsx         # GPS entry logging
│   │   ├── RFIDScanner.jsx      # RFID tag scanning
│   │   ├── Navigation.jsx       # Indoor navigation
│   │   └── Profile.jsx          # User profile
│   ├── services/         # API service layer
│   │   ├── api.js              # Axios instance & interceptors
│   │   └── index.js            # All API endpoints
│   ├── App.jsx           # Main app component with routing
│   ├── main.jsx          # React entry point
│   └── index.css         # Global styles with Tailwind
├── .env                  # Environment variables
├── .env.example          # Environment template
├── package.json          # Dependencies and scripts
├── vite.config.js        # Vite configuration
├── tailwind.config.js    # Tailwind configuration
└── postcss.config.js     # PostCSS configuration
```

## Quick Start

### Prerequisites
- Node.js 16+ and npm
- Backend API running on http://localhost:3000

### Installation

1. **Navigate to frontend directory:**
   ```powershell
   cd d:\library\frontend
   ```

2. **Install dependencies:**
   ```powershell
   npm install
   ```

3. **Configure environment:**
   ```powershell
   # Copy .env.example to .env (already done)
   # Edit .env if needed to change API URL or mode
   ```

4. **Start development server:**
   ```powershell
   npm run dev
   ```

5. **Open browser:**
   ```
   http://localhost:3001
   ```

### Default Login Credentials

**Student Account:**
- Email: `alice@example.com`
- Password: `password123`

**Librarian Account:**
- Email: `carol@example.com`
- Password: `password123`

## Available Scripts

```powershell
# Start development server (with hot reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint
```

## Environment Variables

Create a `.env` file with these variables:

```env
# Backend API URL
VITE_API_URL=http://localhost:3000/api/v1

# Application Mode
VITE_DEMO_MODE=true

# GPS Configuration
VITE_LIBRARY_LATITUDE=37.7749
VITE_LIBRARY_LONGITUDE=-122.4194
VITE_GPS_PROXIMITY_THRESHOLD=50
```

**Mode Switching:**
- `VITE_DEMO_MODE=true` - Handheld RFID reader (manual shelf selection)
- `VITE_DEMO_MODE=false` - Fixed RFID readers (automatic location)

## Key Features Guide

### Authentication Flow
1. Users register with name, email, student ID, password
2. JWT token stored in localStorage
3. Token automatically attached to all API requests
4. Auto-redirect to login on 401 (token expiry)

### Book Search
- Full-text search across title, author, ISBN
- Category filtering (Fiction, Science, Technology, etc.)
- Real-time search results
- Click any book to view details and location

### RFID Scanning
**DEMO Mode:**
- Enter RFID tag ID
- Manually select shelf location
- System records book location

**PRODUCTION Mode:**
- Enter RFID tag ID
- Enter fixed reader ID
- System automatically determines location from reader

### Indoor Navigation
1. Search for a book
2. Select from results
3. Get turn-by-turn directions
4. Receive BLE beacon UUID for mobile scanning
5. Navigate to exact shelf location

### Entry Logging
- Auto-detect GPS coordinates (browser geolocation)
- Optional: Add WiFi SSID for accuracy
- Optional: Add motion speed for confidence
- System calculates confidence score (0-100%)
- Auto-logs entries ≥80% confidence

## API Integration

All API calls go through centralized service layer:

```javascript
import { bookService, authService, rfidService } from '../services';

// Example: Search books
const books = await bookService.searchBooks({ query: 'gatsby' });

// Example: Login
const result = await authService.login(email, password);

// Example: Scan RFID
const scan = await rfidService.scanTag({ tag_id: 'TAG-00001', shelf_id: 5 });
```

**Features:**
- Automatic JWT token injection
- Global error handling
- Auto-redirect on authentication failure
- Request/response interceptors

## Responsive Design

The application is fully responsive with breakpoints:
- **Mobile:** < 768px (single column, hamburger menu)
- **Tablet:** 768px - 1024px (adapted layouts)
- **Desktop:** > 1024px (full sidebar, multi-column)

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Troubleshooting

### CORS Errors
- Ensure backend has CORS enabled
- Backend should allow origin: http://localhost:3001

### API Connection Failed
- Verify backend is running: http://localhost:3000
- Check VITE_API_URL in .env file
- Check network tab in browser DevTools

### Build Errors
```powershell
# Clear cache and reinstall
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

### Hot Reload Not Working
```powershell
# Restart dev server
npm run dev
```

## Production Deployment

### Build for Production
```powershell
npm run build
```

Output: `dist/` directory with optimized static files

### Serve Static Files

**Option 1: Nginx**
```nginx
server {
    listen 80;
    server_name library.example.com;
    root /var/www/library-frontend/dist;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:3000;
    }
}
```

**Option 2: Node.js (serve)**
```powershell
npm install -g serve
serve -s dist -l 3001
```

### Environment Variables for Production
Update `.env` for production:
```env
VITE_API_URL=https://api.library.example.com/api/v1
VITE_DEMO_MODE=false
```

Then rebuild:
```powershell
npm run build
```

## Development Tips

### Add New Page
1. Create component in `src/pages/NewPage.jsx`
2. Add route in `src/App.jsx`
3. Add navigation link in `src/components/Layout.jsx`

### Add New API Endpoint
1. Add service method in `src/services/index.js`
2. Import and use in page component

### Customize Styling
- Edit Tailwind config: `tailwind.config.js`
- Add custom utilities: `src/index.css`
- Use Tailwind classes directly in components

## Performance Optimizations

- ✅ Code splitting with React.lazy (ready to implement)
- ✅ Vite's optimized bundling
- ✅ Minimal dependencies
- ✅ Tree-shaking enabled
- ✅ Source maps for debugging

## Next Steps

1. **Testing:** Add Jest/Vitest for unit tests
2. **E2E Tests:** Add Playwright/Cypress
3. **PWA:** Add service worker for offline support
4. **Analytics:** Integrate usage tracking
5. **i18n:** Add multi-language support

## Support

For issues or questions:
1. Check browser console for errors
2. Verify backend API is running
3. Check network requests in DevTools
4. Review environment variables

---

**Built with ❤️ using React + Vite + Tailwind CSS**
