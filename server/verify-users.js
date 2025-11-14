#!/usr/bin/env node

import { initDatabase, allAsync } from './db.js';

async function main() {
  try {
    const db = await initDatabase();
    const users = await allAsync(db, 'SELECT id, email, username, role FROM users');
    
    console.log('\n✅ Utenti nel database:');
    console.log('=======================');
    if (users && users.length > 0) {
      users.forEach((user, idx) => {
        console.log(`${idx + 1}. ${user.email} (${user.username}) - role: ${user.role}`);
      });
    } else {
      console.log('❌ Nessun utente trovato nel database!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Errore:', error.message);
    process.exit(1);
  }
}

main();
