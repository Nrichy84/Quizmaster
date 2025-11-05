import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('./quizmaster.sqlite', err => {
  if (err) {
    console.error('❌ Nem sikerült csatlakozni az adatbázishoz:', err.message);
    process.exit(1);
  } else {
    console.log('✅ Csatlakozva az adatbázishoz.');
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
  )
`);

// TOURNAMENTS tábla
db.run(`
  CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    entry_fee INTEGER DEFAULT 0,
    prize_pool INTEGER DEFAULT 0,
    player_count INTEGER DEFAULT 0,
    start_time TEXT NOT NULL
  )
`);

// TOURNAMENT_PLAYERS tábla
db.run(`
  CREATE TABLE IF NOT EXISTS tournament_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    tournament_id INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(tournament_id) REFERENCES tournaments(id)
  )
`);

db.close(() => console.log('✅ Adatbázis inicializálva és lezárva.'));