# User Data Recovery & Migration Guide

## 🔴 Problema Riscontrato

Gli utenti registrati localmente nel browser (localStorage) non erano sincronizzati con il database SQLite del backend Render. Questo ha causato errori di login per gli utenti con dati locali.

## ✅ Soluzione Implementata

### 1. **Login Fallback System**
Ora il sistema prova automaticamente:
1. Login via backend (nuovo database SQLite)
2. Se fallisce → Login via localStorage (dati locali come fallback)
3. Mostro messaggio di avviso all'utente

**Risultato:** Gli utenti possono ancora accedere con le loro credenziali locali!

### 2. **User Migration Endpoints**
Aggiunti due endpoint sul backend:
- `POST /api/migrate/users-from-localstorage` - Migra utenti da localStorage a SQLite
- `GET /api/migrate/check-user/:email` - Verifica se un utente esiste sul backend

### 3. **Migration UI Component**
Nuovo componente `UserMigrationPanel.tsx` che permette:
- Cercare utenti nel localStorage
- Esportare i dati
- Sincronizzare con il backend tramite token sicuro

## 🔧 Come Recuperare i Tuoi Dati

### Opzione 1: Accesso Automatico con Fallback (⭐ Consigliato)

1. Accedi normalmente a https://outdoor-maps-app.vercel.app
2. Usa le tue credenziali locali (email e password originali)
3. Se il backend non ha l'utente, farà fallback al localStorage
4. Vedrai un messaggio: "ℹ️ Accesso con dati locali. Sincronizzazione con server in corso..."
5. Sei loggato! ✅

### Opzione 2: Migrazione Manuale (Per Admin)

Se sei un amministratore e hai il token di migrazione:

1. Accedi come admin
2. Apri le Developer Tools (F12)
3. Vai in Console
4. Esegui:
```javascript
// Estrai gli utenti dal localStorage
const usersStr = localStorage.getItem('singletrack_users');
const users = JSON.parse(usersStr || '[]');
console.log('Utenti trovati:', users);

// Poi usa l'API di migrazione
const response = await fetch('https://singletrack-backend.onrender.com/api/migrate/users-from-localstorage', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_MIGRATION_TOKEN_HERE'
  },
  body: JSON.stringify({ users })
});

const result = await response.json();
console.log(result);
```

### Opzione 3: Export/Import UI (Quando disponibile)

Una volta aggiunto al Sidebar Settings:
1. Sidebar → ⚙️ Settings
2. Clicca "🔄 Sincronizza Dati"
3. Seleziona il token di migrazione
4. Clicca "Sincronizza"
5. Dati migrati! ✅

## 🗝️ Migration Token

Il token di migrazione è una chiave di sicurezza per evitare migrazioni non autorizzate.

**Come generare il token:**
```bash
# Sul server (o localmente)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Dove usarlo:**
Aggiungi a `server/.env`:
```
MIGRATION_TOKEN=YOUR_GENERATED_TOKEN_HERE
```

## 📊 Database Recovery

Se i dati su Render sono stati persi:

### Step 1: Esportare da localStorage
```javascript
// Console del browser
const users = JSON.parse(localStorage.getItem('singletrack_users') || '[]');
const tracks = JSON.parse(localStorage.getItem('singletrack_tracks') || '[]');
const pois = JSON.parse(localStorage.getItem('singletrack_pois') || '[]');
const tours = JSON.parse(localStorage.getItem('singletrack_tours') || '[]');

// Scarica come JSON
console.log(JSON.stringify({ users, tracks, pois, tours }, null, 2));
```

### Step 2: Backup su file
```bash
# Salva il JSON in un file
# backs_up_data.json
```

### Step 3: Ripristinare su backend
```bash
# Se il database è compromesso, ricrea con migrazione
node -e "
const db = require('./db.js');
const migration = require('./migrationController.js');

// Carica dati da file e migra
"
```

## 🔐 Sicurezza

### Protezioni implementate:
✅ Token richiesto per migrazione
✅ Fallback sicuro al localStorage
✅ Password hashate con bcryptjs su backend
✅ Nessuna esportazione di password in chiaro

### Best practices:
⚠️ Non condividere il MIGRATION_TOKEN
⚠️ Non esporre localStorage su UI pubblica
⚠️ Sempre usare HTTPS in produzione
⚠️ Fare backup regolari

## 📝 Flusso di Login Completo

```
Utente inserisce credenziali
        ↓
    Backend Login
        ↓
    ✅ Successo? → JWT tokens → Accesso concesso
        ↓ Fallback
    localStorage Login
        ↓
    ✅ Trovato? → Session locale → Accesso con avviso
        ↓ Fallback
    Credenziali non valide → Errore
```

## 🔄 Prossimi Step

1. **Comunicare agli utenti** il nuovo sistema di fallback
2. **Fornire token di migrazione** agli admin
3. **Aggiungere UI** per migrazione manuale nel Settings
4. **Monitorare** login fallback per identificare utenti non ancora migrati
5. **Pianificare** termine del supporto fallback (es. tra 30 giorni)

## 📞 Troubleshooting

### Problema: "Credenziali non valide"
**Soluzione:**
1. Verifica email/password nel localStorage
2. Controlla che il browser non abbia cancellato localStorage
3. Prova in una finestra privata
4. Contatta admin se il problema persiste

### Problema: "Errore durante la sincronizzazione"
**Soluzione:**
1. Verifica il token di migrazione
2. Assicurati che il backend sia online: `https://singletrack-backend.onrender.com/api/health`
3. Controlla la console per errori dettagliati
4. Riprova dopo qualche minuto

### Problema: "Utente non trovato"
**Causa:** Utente non sincronizzato ancora
**Soluzione:**
1. Usa opzione 2 (migrazione manuale) se sei admin
2. O accedi con fallback e attendi sincronizzazione
3. Contatta admin per assistenza

## 🎯 Timeline

- **Oggi**: Fallback system attivo
- **Settimana 1**: Comunicazione agli utenti
- **Settimana 2**: Admin distribuisce migration token
- **Settimana 3**: Utenti cominciano a migrare
- **Settimana 4**: Monitoring fase fallback
- **Settimana 5**: Disattivare fallback se >90% migrati

## 📚 File Modificati

Backend:
- `server/index.js` - Nuovi endpoint /api/migrate
- `server/migrationController.js` - Logica di migrazione

Frontend:
- `src/services/backendAuth.ts` - loginViaBackendWithFallback()
- `src/services/migrationService.ts` - Utility per migrazione
- `src/components/LoginForm.tsx` - Supporto fallback
- `src/components/UserMigrationPanel.tsx` - UI migrazione

## 🚀 Deployment

```bash
# 1. Commit changes
git add -A && git commit -m "Add migration system"

# 2. Push to GitHub
git push origin main

# 3. Vercel auto-deploys (frontend)
# 4. Render auto-deploys (backend)

# 5. Verifica endpoints
curl https://singletrack-backend.onrender.com/api/health
curl https://singletrack-backend.onrender.com/api/migrate/check-user/test@example.com
```

## 📖 Documentazione

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Guida deployment
- [server/README.md](./server/README.md) - Backend docs
- [README.md](./README.md) - Frontend docs
