#!/usr/bin/env node

/**
 * Admin Migration Script
 * Sincronizza gli utenti da localStorage a SQLite backend
 * 
 * Uso: node admin-migrate.js
 */

import { initDatabase } from './db.js';
import { migrateUsersFromLocalStorage } from './migrationController.js';
import readline from 'readline';
import fs from 'fs';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => {
    rl.question(query, resolve);
  });
}

async function main() {
  console.log('🔄 Admin Migration Script');
  console.log('========================\n');

  try {
    // Step 1: Chiedi il file JSON con i dati
    const filePath = await question('📁 Path al file JSON con utenti (es: users.json): ');
    
    if (!fs.existsSync(filePath)) {
      console.error('❌ File non trovato:', filePath);
      rl.close();
      process.exit(1);
    }

    // Step 2: Leggi il file
    console.log('\n📖 Lettura file...');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    let users = [];

    try {
      const data = JSON.parse(fileContent);
      
      // Gestisci vari formati
      if (Array.isArray(data)) {
        users = data;
      } else if (data.users && Array.isArray(data.users)) {
        users = data.users;
      } else {
        console.error('❌ Formato JSON non valido. Atteso array o oggetto con proprietà "users"');
        rl.close();
        process.exit(1);
      }
    } catch (err) {
      console.error('❌ Errore parsing JSON:', err.message);
      rl.close();
      process.exit(1);
    }

    console.log(`✅ Trovati ${users.length} utenti nel file\n`);

    // Step 3: Mostra preview
    console.log('👥 Preview utenti:');
    users.slice(0, 5).forEach((user, idx) => {
      console.log(`  ${idx + 1}. ${user.email} (${user.username}) - Role: ${user.role || 'free'}`);
    });
    if (users.length > 5) {
      console.log(`  ... e altri ${users.length - 5} utenti`);
    }

    // Step 4: Conferma
    const confirm = await question('\n✅ Procedere con la sincronizzazione? (s/n): ');
    
    if (confirm.toLowerCase() !== 's' && confirm.toLowerCase() !== 'y') {
      console.log('❌ Sincronizzazione annullata.');
      rl.close();
      process.exit(0);
    }

    // Step 5: Inizializza DB
    console.log('\n⏳ Inizializzazione database...');
    const db = await initDatabase();
    console.log('✅ Database inizializzato\n');

    // Step 6: Esegui migrazione
    console.log('🔄 Sincronizzazione in corso...');
    const result = await migrateUsersFromLocalStorage(db, users);

    // Step 7: Report risultati
    console.log('\n' + '='.repeat(50));
    console.log('📊 RISULTATI MIGRAZIONE');
    console.log('='.repeat(50));
    console.log(`✅ Successo: ${result.migrated} utenti`);
    console.log(`⏭️  Saltati: ${result.skipped} utenti`);
    
    if (result.errors && result.errors.length > 0) {
      console.log(`\n❌ Errori (${result.errors.length}):`);
      result.errors.forEach(err => {
        console.log(`  • ${err}`);
      });
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Sincronizzazione completata!');
    console.log('='.repeat(50));

    // Chiudi DB
    db.close();
    rl.close();
    process.exit(0);

  } catch (err) {
    console.error('❌ Errore:', err);
    rl.close();
    process.exit(1);
  }
}

main();
