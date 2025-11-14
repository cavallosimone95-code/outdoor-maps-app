# 🚀 Quick Admin Sync Guide

Segui questi step per sincronizzare i dati come admin:

## Step 1: Esporta i dati dal browser

1. Apri il file `export-local-data.html` nel browser
   - Oppure vai a: `file:///Users/simonecavallo/Applications/Chrome\ Apps.localized/outdoor-maps-app/export-local-data.html`

2. Clicca **"🔍 Cerca Dati"**
   - Vedrà tutti gli utenti salvati nel localStorage

3. Clicca **"📥 Scarica JSON"**
   - Si scarica un file `singletrack-export-YYYYMMDD.json`

## Step 2: Genera migration token

Nel terminale, genera un token sicuro:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Output esempio:
```
a3f7e9d2c4b1f8e6a9d2c1b4f7e9a3d5c8b1f4e7a9d2c1b4f7e9a3d5c8b1f4
```

## Step 3: Imposta il token nel backend

1. Apri `server/.env`
2. Aggiungi:
```
MIGRATION_TOKEN=a3f7e9d2c4b1f8e6a9d2c1b4f7e9a3d5c8b1f4e7a9d2c1b4f7e9a3d5c8b1f4
```

3. Restarta il backend (Render farà auto-restart su push)

## Step 4: Esegui lo script di migrazione

Nel terminale del server:

```bash
cd /Users/simonecavallo/Applications/Chrome\ Apps.localized/outdoor-maps-app/server

# Installa dipendenze se necessario
npm install

# Esegui script
node admin-migrate.js
```

Ti chiederà:
1. Path al file JSON (es: `../singletrack-export-2025-11-14.json`)
2. Mostra preview degli utenti
3. Chiede conferma

## Step 5: Verifica sincronizzazione

Nel browser:
1. Apri https://outdoor-maps-app.vercel.app
2. Prova a fare login con:
   - Email admin
   - Password admin
3. Dovresti entrarvi senza avviso di fallback

## Troubleshooting

### Problema: "File non trovato"
Assicurati il file JSON sia nel path corretto:
```bash
# Sposta il file nella cartella server
mv ~/Downloads/singletrack-export-*.json ./server/
```

### Problema: "Utenti non migrati"
Controlla i log dello script per errori specifici

### Problema: "Token non valido"
Verifica che:
1. Il token sia impostato in `server/.env`
2. Il backend sia stato restartato
3. Il token sia copiato correttamente

## Dopo la migrazione

1. ✅ Accedi come admin
2. ✅ Verifica che i dati siano presenti
3. ✅ Opzionale: Cancella localStorage con il bottone 🗑️ nel file HTML
4. ✅ Comunica agli altri utenti il token per migrazione manuale

## Alternative veloci

Se preferisci non usare lo script, puoi fare tutto dalla console del browser:

```javascript
// 1. Leggi utenti
const users = JSON.parse(localStorage.getItem('singletrack_users'));
console.log('Utenti:', users);

// 2. Invia al backend
const response = await fetch('https://singletrack-backend.onrender.com/api/migrate/users-from-localstorage', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_MIGRATION_TOKEN'
  },
  body: JSON.stringify({ users })
});

const result = await response.json();
console.log('Risultato:', result);
```

---

**Hai bisogno di aiuto? Controlla USER_RECOVERY_GUIDE.md per dettagli completi!**
