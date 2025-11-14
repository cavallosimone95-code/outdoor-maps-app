# Singletrack Outdoor Maps

Full-stack React + TypeScript + Node.js application for outdoor maps, trails, and points of interest with complete authentication and backend infrastructure.

## 🎯 Features

- 🗺️ Interactive outdoor map with trails and POIs
- 👤 User authentication with JWT tokens
- 🏔️ Create, share, and manage outdoor tracks
- 📍 Add and manage points of interest (POIs)
- 🎫 Create and manage tours
- ⭐ Rate and review tracks
- 🔐 Secure backend with password hashing
- 📱 Responsive design
- 🌐 Full REST API

## 🚀 Quick Start

### Frontend
```bash
npm install
npm start  # Runs on http://localhost:3000
```

### Backend
```bash
cd server
npm install
npm start  # Runs on http://localhost:5000
```

## 📁 Project Structure

```
outdoor-maps-app/
├── src/
│   ├── components/
│   │   ├── AuthPage.tsx          # Login/Register pages
│   │   ├── LoginForm.tsx         # Login form
│   │   ├── RegisterForm.tsx      # Registration form
│   │   ├── UserProfile.tsx       # User profile management
│   │   ├── MapView.tsx           # Interactive map
│   │   ├── Sidebar.tsx           # Navigation sidebar
│   │   ├── CreateTrackForm.tsx   # Create new track
│   │   ├── AddPOIForm.tsx        # Add POI
│   │   ├── CreateTourForm.tsx    # Create tour
│   │   └── ...more components
│   ├── services/
│   │   ├── backendAuth.ts        # Authentication service
│   │   ├── trackServiceBackend.ts # Tracks API
│   │   ├── poiServiceBackend.ts  # POIs API
│   │   ├── tourServiceBackend.ts # Tours API
│   │   ├── reviewServiceBackend.ts # Reviews API
│   │   └── ...more services
│   ├── utils/
│   │   ├── apiConfig.ts          # API configuration & token management
│   │   └── ...utilities
│   └── styles/
│       └── main.css
├── server/
│   ├── index.js                  # Express app & routes
│   ├── db.js                     # SQLite database
│   ├── middleware.js             # JWT & auth middleware
│   ├── authController.js         # Auth logic
│   ├── trackController.js        # Tracks CRUD
│   ├── poiController.js          # POIs CRUD
│   ├── tourController.js         # Tours CRUD
│   ├── reviewController.js       # Reviews CRUD
│   ├── package.json
│   └── .env
├── public/
├── package.json
└── README.md
```

## 🔐 Authentication

JWT-based authentication with:
- Access tokens (24h validity)
- Refresh tokens (7d validity)
- Password hashing with bcryptjs
- Rate limiting (5 login attempts/15min)

## 🌐 Deployment

### Frontend (Vercel)
- **URL**: https://outdoor-maps-app.vercel.app
- **Auto-deploys** on git push to main branch
- Supports environment variables

### Backend (Render)
- **URL**: https://singletrack-backend.onrender.com
- **Auto-deploys** on git push
- SQLite database persisted on disk
- Free tier with 750 free compute hours/month

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token

### Users
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/profile` - Update user profile
- `POST /api/users/change-password` - Change password

### Tracks
- `POST /api/tracks` - Create track (auth)
- `GET /api/tracks/approved` - Get public tracks
- `GET /api/tracks/user` - Get user's tracks (auth)
- `GET /api/tracks/:id` - Get track details
- `PUT /api/tracks/:id` - Update track (auth, owner only)
- `DELETE /api/tracks/:id` - Delete track (auth, owner only)

### POIs
- `POST /api/pois` - Create POI (auth)
- `GET /api/pois/approved` - Get public POIs
- `GET /api/pois/user` - Get user's POIs (auth)
- `GET /api/pois/:id` - Get POI details
- `PUT /api/pois/:id` - Update POI (auth, owner only)
- `DELETE /api/pois/:id` - Delete POI (auth, owner only)

### Tours
- `POST /api/tours` - Create tour (auth)
- `GET /api/tours` - Get all tours
- `GET /api/tours/user` - Get user's tours (auth)
- `GET /api/tours/:id` - Get tour details
- `PUT /api/tours/:id` - Update tour (auth, owner only)
- `DELETE /api/tours/:id` - Delete tour (auth, owner only)

### Reviews
- `POST /api/reviews` - Create review (auth)
- `GET /api/reviews/track/:trackId` - Get track reviews
- `GET /api/reviews/user` - Get user's reviews (auth)
- `GET /api/reviews/:id` - Get review details
- `PUT /api/reviews/:id` - Update review (auth, owner only)
- `DELETE /api/reviews/:id` - Delete review (auth, owner only)

## 🛠️ Tech Stack

### Frontend
- React 18.2.0
- TypeScript 4.9.5
- Vite/Create React App
- Leaflet for maps
- Axios for HTTP requests

### Backend
- Node.js + Express 4.18.2
- SQLite3
- JWT for authentication
- bcryptjs for password hashing
- express-rate-limit for rate limiting
- CORS enabled

## 📝 Environment Variables

### Frontend (.env)
```
REACT_APP_API_BASE=https://singletrack-backend.onrender.com
REACT_APP_MAP_PROVIDER=komoot
```

### Backend (server/.env)
```
PORT=5000
JWT_SECRET=your_secret_key_here
NODE_ENV=production
DB_PATH=./data/singletrack.db
CORS_ORIGIN=https://outdoor-maps-app.vercel.app
```

## 🔄 Workflow

1. **Local Development**
   ```bash
   npm start          # Frontend on :3000
   cd server && npm run dev  # Backend on :5000
   ```

2. **Testing**
   ```bash
   npm test           # Run tests
   ```

3. **Deployment**
   ```bash
   git push origin main
   # Frontend auto-deploys to Vercel
   # Backend auto-deploys to Render
   ```

## 📖 Additional Resources

- [Copilot Instructions](./copilot-instructions.md)
- [Backend README](./server/README.md)
- [Google Maps Setup](./GOOGLE_MAPS_API_SETUP.md)

## 👨‍💻 Development Guidelines

See [copilot-instructions.md](./copilot-instructions.md) for detailed information about:
- File structure and integration points
- Important implementation patterns
- Common tasks and where to find them
- Known gotchas and conventions4. Start the application:
   ```
   npm start
   ```

## Usage

- Open your browser and navigate to `http://localhost:3000` to view the application.
- Use the sidebar to filter and navigate through different points of interest on the map.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License.