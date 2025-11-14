# 💾 Guida Backup e Sincronizzazione Utenti

## Scenario
Hai dati utenti memorizzati in localStorage su una vecchia installazione dell'app e vuoi sincronizzarli al backend online (Render).

## Come funziona

### Opzione 1: Export diretto da localStorage

**Passo 1: Estrai i dati**
```bash
# Apri la Developer Console del browser (F12)
# Incolla questo codice e premi Enter:

const users = localStorage.getItem('users');
console.log(JSON.stringify(JSON.parse(users), null, 2));
// Copia l'output nel file users-backup.json
```

**Passo 2: Carica il backup sull'app online**
1. Apri https://outdoor-maps-app.vercel.app
2. Apri il file `backup-users.html` che si trova nella root del progetto
3. Segui i 4 step nella UI

### Opzione 2: Usa il file backup-users.html

**Per caricare da localhost:**
1. Apri `file:///Users/simonecavallo/Applications/Chrome\ Apps.localized/outdoor-maps-app/backup-users.html` nel browser
2. Clicca "Estrai utenti da localStorage"
3. Scarica il file `backup-users-YYYY-MM-DD.json`
4. Incolla il token di migrazione (disponibile in `server/.env`)
5. Clicca "Sincronizza"

**Per caricare su vercel app online:**
1. Apri https://outdoor-maps-app.vercel.app
2. Apri Developer Console (F12)
3. Incolla questo codice:
```javascript
// Estrai JSON dai localStorage
const users = JSON.parse(localStorage.getItem('users'));
console.log(JSON.stringify(users));
// Copia l'output
```

4. Salva l'output in un file `users-backup.json`
5. Vai a https://outdoor-maps-app.vercel.app/backup-users.html (se ospitato)
6. O usa la console Vercel per caricare via API

## Token di migrazione

Il token è salvato in `server/.env`:
```bash
MIGRATION_TOKEN=61fca8d79bfa9674a062b108d67f9b5fb6edc3e4be6c7a5bb84aa0e2fa3cd120
```

Se hai perso il token, generane uno nuovo:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Aggiorna server/.env con il nuovo token
# Aggiorna anche server/index.js se necessario
```

## Endpoint di migrazione

**POST** `/api/migrate/users-from-localstorage`

```bash
curl -X POST https://singletrack-backend.onrender.com/api/migrate/users-from-localstorage \
  -H "Content-Type: application/json" \
  -H "X-Migration-Token: 61fca8d79bfa9674a062b108d67f9b5fb6edc3e4be6c7a5bb84aa0e2fa3cd120" \
  -d @users-backup.json
```

### Request body
```json
[
  {
    "email": "admin@singletrack.app",
    "password": "admin123",
    "username": "admin",
    "isAdmin": true,
    "firstName": "Admin",
    "lastName": "User"
  }
]
```

### Response
```json
{
  "success": true,
  "message": "Migration completed: 1 users migrated, 0 skipped",
  "migrated": 1,
  "skipped": 0
}
```

## Sicurezza

⚠️ **Importante**: 
- Il token di migrazione è disponibile solo una volta
- Cambia il token dopo aver completato la migrazione
- Non condividere il token con nessuno
- Elimina il backup JSON locale dopo la sincronizzazione

## Troubleshooting

### "Network error" al login
- Verifica che https://singletrack-backend.onrender.com sia online
- Controlla che il token in `server/.env` sia corretto
- Verifica CORS su backend per il dominio di Vercel

### "Invalid token"
- Copia il token esatto da `server/.env`
- Assicurati di avere il token più recente
- Se cambiato, aggiorna il backup-users.html

### Utenti non sincronizzati
- Verifica che il JSON sia correttamente formattato
- Controlla che le email siano uniche
- Verifica il database con: `sqlite3 server/data/singletrack.db "SELECT * FROM users;"`

## Pulizia dopo la sincronizzazione

Una volta completata la migrazione:

1. **Cancella il backup JSON locale** - non più necessario
2. **Cancella localStorage** - per forzare l'uso del backend
   ```javascript
   localStorage.clear();
   ```
3. **Aggiorna il token** se desideri continuare con altre migrazioni

## Verifica

Per verificare che gli utenti siano stati sincronizzati:

**Da terminale:**
```bash
cd /Users/simonecavallo/Applications/Chrome\ Apps.localized/outdoor-maps-app
node server/verify-users.js
```

**Da browser:**
```javascript
// Nel developer console dell'app
fetch('/api/users/me')
  .then(r => r.json())
  .then(d => console.log(d))
```

## Note

- Il file `backup-users.html` è completamente standalone e sicuro
- Tutti i dati rimangono nel tuo browser fino al click di "Sincronizza"
- Il file di backup è un semplice JSON - puoi modificarlo manualmente se necessario
- La sincronizzazione è idempotente - puoi ripeterla senza duplicati

