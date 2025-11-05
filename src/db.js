import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔧 Mindig a főmappában lévő adatbázist használja:
const dbPath = path.join(__dirname, '..',  'quizmaster.sqlite3');
console.log("🗄️ Aktív adatbázis útvonal:\n" + path.resolve(__dirname, '../quizmaster.sqlite3'));

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Adatbázis hiba:', err.message);
  } else {
    console.log('✅ Kapcsolódva az adatbázishoz.');
  }
});

// USERS tábla
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    tokens INTEGER DEFAULT 10000,
    credits INTEGER DEFAULT 0
  );
`);

// TOURNAMENTS tábla
db.run(`
  CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    entry_fee INTEGER DEFAULT 0,
    start_time TEXT NOT NULL,
    player_count INTEGER DEFAULT 0,
    prize_pool INTEGER DEFAULT 0,
    status TEXT DEFAULT 'scheduled'
  );
`);

// TOURNAMENT PLAYERS tábla
db.run(`
  CREATE TABLE IF NOT EXISTS tournament_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    tournament_id INTEGER,
    UNIQUE(user_id, tournament_id)
  );
`);

console.log('📂 Adatbázis szerkezete ellenőrizve / létrehozva.');

export default db;