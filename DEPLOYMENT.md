# Deployment & Maintenance Guide

## 🚀 Current Infrastructure

### Frontend
- **Platform**: Vercel
- **URL**: https://outdoor-maps-app.vercel.app
- **Auto-deploy**: On git push to main branch
- **Build command**: `npm run build`
- **Start command**: `npm start`

### Backend
- **Platform**: Render (Free Tier)
- **URL**: https://singletrack-backend.onrender.com
- **Auto-deploy**: On git push to main branch
- **Database**: SQLite3 (persisted in /data directory)
- **Memory**: 512 MB
- **Build command**: `npm install`
- **Start command**: `npm start`

## 📋 Deployment Checklist

### Before Pushing to Production

1. **Test Locally**
   ```bash
   # Terminal 1: Frontend
   npm install
   npm start

   # Terminal 2: Backend
   cd server
   npm install
   npm run dev
   ```

2. **Verify Environment Variables**
   - Frontend `.env`: `REACT_APP_API_BASE` set to backend URL
   - Backend `server/.env`: All required variables set

3. **Run Tests**
   ```bash
   npm test
   ```

4. **Check for Errors**
   ```bash
   npm run build
   ```

### Deployment Steps

1. **Commit Changes**
   ```bash
   git add -A
   git commit -m "Description of changes"
   ```

2. **Push to GitHub**
   ```bash
   git push origin main
   ```

3. **Wait for Auto-Deploy**
   - **Vercel**: 2-3 minutes
   - **Render**: 3-5 minutes

4. **Verify Deployment**
   - Frontend: https://outdoor-maps-app.vercel.app
   - Backend: https://singletrack-backend.onrender.com/api/health

## 🔧 Common Maintenance Tasks

### Update Backend on Render

If you need to install new dependencies:

1. Update `server/package.json` with new dependency
2. Push to GitHub
3. Render will automatically:
   - Run `npm install`
   - Start the server with `npm start`
4. Monitor server logs in Render dashboard

### Database Management

SQLite database is stored at `/data/singletrack.db` on Render:
- **Backup**: Download from Render file system
- **Reset**: Delete `singletrack.db` (recreates on next startup)
- **Access**: Use Render shell to query database

```bash
# Connect to Render shell
# Run SQL queries via Node.js script
```

### Environment Variables

#### Frontend (Vercel)
Set in Vercel Dashboard → Settings → Environment Variables:
```
REACT_APP_API_BASE=https://singletrack-backend.onrender.com
REACT_APP_MAP_PROVIDER=komoot
REACT_APP_THUNDERFOREST_KEY=your_key
```

#### Backend (Render)
Set in Render Dashboard → Service Settings → Environment:
```
PORT=5000
JWT_SECRET=your_super_secret_key
NODE_ENV=production
DB_PATH=./data/singletrack.db
CORS_ORIGIN=https://outdoor-maps-app.vercel.app
```

## 🐛 Troubleshooting

### Frontend not connecting to backend

1. Check `REACT_APP_API_BASE` in Vercel env vars
2. Verify backend URL is correct
3. Check browser console for CORS errors
4. Test backend health: `https://singletrack-backend.onrender.com/api/health`

### Render backend crashes on startup

1. Check Render logs for error messages
2. Verify `package.json` in server directory
3. Check `index.js` for syntax errors
4. Verify all dependencies are installed

### Database issues

1. Check if `/data` directory exists on Render
2. Verify `DB_PATH` environment variable
3. Check SQLite database file permissions
4. If corrupted, delete and let it recreate

### Authentication not working

1. Verify `JWT_SECRET` is set on Render
2. Check token storage in browser localStorage
3. Test login endpoint: `POST /api/auth/login`
4. Verify CORS_ORIGIN matches frontend URL

## 📊 Monitoring

### Vercel
- Dashboard: https://vercel.com/dashboard
- View build logs and deployment history
- Monitor performance and analytics

### Render
- Dashboard: https://dashboard.render.com
- View service logs in real-time
- Monitor CPU and memory usage
- Check deployment status

## 🔄 Continuous Integration

### GitHub Actions (Optional)

To add automated testing and deployment:

1. Create `.github/workflows/deploy.yml`
2. Add test and build steps
3. Auto-deploy on successful tests

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - run: npm test
```

## 📈 Scaling Considerations

Current setup works for:
- ~100 concurrent users
- ~10,000 tracks/POIs
- ~1,000 active users

For higher scale:
- **Database**: Migrate to PostgreSQL on Render Databases
- **Backend**: Scale to multiple instances (Render Pro)
- **Frontend**: Keep on Vercel (handles scale automatically)
- **Storage**: Use S3 for images and user uploads

## 💾 Backup Strategy

### Daily Backups

Create a backup script (`backup.sh`):
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
wget https://singletrack-backend.onrender.com/api/health
# Then download database from Render
```

Run via cron job:
```bash
0 2 * * * /path/to/backup.sh
```

### Data Export

Frontend already supports JSON export via DataManager component.

## 🚀 Future Improvements

- [ ] Add email notifications
- [ ] Implement pagination for large datasets
- [ ] Add image upload to S3
- [ ] Migrate to PostgreSQL
- [ ] Add logging service (Sentry)
- [ ] Implement API versioning
- [ ] Add GraphQL endpoint
- [ ] Implement caching (Redis)
- [ ] Add webhook support
- [ ] Implement analytics

## 📞 Support

For issues:
1. Check Render and Vercel logs
2. Review error messages in browser console
3. Check GitHub issues
4. Contact maintainer

## 📚 Resources

- Render Docs: https://render.com/docs
- Vercel Docs: https://vercel.com/docs
- Express Docs: https://expressjs.com
- React Docs: https://react.dev
- SQLite Docs: https://sqlite.org/docs.html
