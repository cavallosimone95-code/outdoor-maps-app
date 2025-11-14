#!/usr/bin/env node

/**
 * Admin Migration Script (Non-Interactive)
 * Sincronizza gli utenti da JSON file a SQLite backend
 * 
 * Uso: node admin-migrate-auto.js <path-to-json>
 */

import { initDatabase } from './db.js';
import { migrateUsersFromLocalStorage } from './migrationController.js';
import fs from 'fs';

async function main() {
  console.log('🔄 Admin Migration Script (Auto)');
  console.log('==================================\n');

  try {
    // Ottieni il path dal primo argomento
    const filePath = process.argv[2];
    
    if (!filePath) {
      console.error('❌ Uso: node admin-migrate-auto.js <path-to-json>');
      process.exit(1);
    }
    
    if (!fs.existsSync(filePath)) {
      console.error('❌ File non trovato:', filePath);
      process.exit(1);
    }

    // Leggi il file
    console.log('📖 Lettura file:', filePath);
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
        throw new Error('Formato JSON non riconosciuto. Aspetta un array o {users: []}');
      }
    } catch (parseError) {
      console.error('❌ Errore parsing JSON:', parseError.message);
      process.exit(1);
    }

    console.log(`✅ ${users.length} utenti letti dal file\n`);

    // Mostra preview
    console.log('📋 Preview utenti:');
    console.log('------------------');
    users.forEach((user, idx) => {
      console.log(`${idx + 1}. ${user.email} (${user.username || 'no-username'})${user.isAdmin ? ' [ADMIN]' : ''}`);
    });
    console.log('\n');

    // Inizializza DB
    console.log('🗄️  Inizializzo database...');
    const db = await initDatabase();
    console.log('✅ Database pronto\n');

    // Migrazione
    console.log('🚀 Inizio migrazione...');
    const result = await migrateUsersFromLocalStorage(db, users);
    
    console.log('\n✅ Migrazione completata!');
    console.log('========================');
    console.log(`✓ Utenti migrati: ${result.migrated}`);
    console.log(`⊘ Utenti saltati (duplicati): ${result.skipped}`);
    if (result.errors && result.errors.length > 0) {
      console.log(`✗ Errori: ${result.errors.length}`);
      result.errors.forEach(err => console.log(`  - ${err}`));
    }

    console.log('\n🎉 Sincronizzazione completata!');
    console.log('Puoi ora accedere con le tue credenziali al backend.');
    
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Errore durante la migrazione:');
    console.error(error.message);
    process.exit(1);
  }
}

main();
