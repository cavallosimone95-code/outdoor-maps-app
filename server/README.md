# Singletrack Backend

Backend Node.js + Express per Singletrack Outdoor Maps con sicurezza migliorata.

## 🚀 Installazione

```bash
cd server
npm install
```

## 🔧 Configurazione

1. Copia `.env.example` a `.env`:
```bash
cp .env.example .env
```

2. Configura le variabili in `.env`:
```
PORT=5000
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
NODE_ENV=development
DB_PATH=./data/singletrack.db
CORS_ORIGIN=http://localhost:3000,https://outdoor-maps-app.vercel.app
```

## 📦 Dipendenze

- **express**: Web framework
- **cors**: CORS middleware
- **sqlite3**: Database
- **bcryptjs**: Password hashing
- **jsonwebtoken**: JWT authentication
- **express-rate-limit**: Rate limiting
- **dotenv**: Environment variables

## 🏃 Esecuzione

### Sviluppo (con hot reload)
```bash
npm run dev
```

### Produzione
```bash
npm start
```

Server sarà disponibile su `http://localhost:5000`

## 🔐 Sicurezza

### Implementato:
- ✅ Password hashing con bcryptjs (10 rounds)
- ✅ JWT authentication (24h access token)
- ✅ Refresh token (7d validity)
- ✅ Rate limiting (100 req/15min generale, 5 login/15min)
- ✅ CORS protection
- ✅ Input validation
- ✅ Ban system
- ✅ Role-based access control (RBAC)
- ✅ SQLite database (persiste su disk)

## 📚 API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token

### Users
- `GET /api/users/me` - Get current user
- `PUT /api/users/profile` - Update profile
- `POST /api/users/change-password` - Change password

### Health
- `GET /api/health` - Health check

## 🗄️ Database Schema

### Users
- id, email, username, passwordHash
- firstName, lastName, birthDate
- role, approved, isBanned, bannedReason
- profilePhoto, bio, location, phone, website
- socialLinks (instagram, facebook, strava)

### Tracks
- id, userId, name, description
- difficulty, distance, elevation data
- points (GeoJSON), approved status

### POIs
- id, userId, name, category
- latitude, longitude, description
- approved status

### Tours
- id, userId, name, description
- trackIds (array), difficulty
- totalLength

### Reviews
- id, trackId, userId
- rating (1-5), comment
- trailCondition

## 📝 TODO

- [ ] Implement track endpoints (CRUD + approval)
- [ ] Implement POI endpoints (CRUD + approval)
- [ ] Implement tour endpoints (CRUD)
- [ ] Implement review endpoints (CRUD)
- [ ] Admin panel endpoints
- [ ] Email verification
- [ ] Password reset via email
- [ ] User management (ban, demote, etc)
- [ ] Deployment to Railway/Render/Heroku

## 🚀 Deploy

### Opzione 1: Railway (Consigliato)
1. Push su GitHub
2. Connetti Railway al repo GitHub
3. Seleziona cartella `server`
4. Configura env vars su Railway
5. Deploy

### Opzione 2: Render
1. Crea account su render.com
2. New → Web Service
3. Connetti GitHub repo
4. Build command: `cd server && npm install`
5. Start command: `npm start`

### Opzione 3: Heroku (Deprecato)
Heroku ha rimosso il free tier. Non consigliato per nuovi progetti.

## 📧 Contatti

Simone Cavallo - cavallosimone95@gmail.com
