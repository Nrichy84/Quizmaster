import sqlite3 from 'sqlite3';

// Csatlakozás az adatbázishoz
const db = new sqlite3.Database('./quizmaster.sqlite', err => {
  if (err) {
    console.error('❌ Nem sikerült csatlakozni az adatbázishoz:', err.message);
    process.exit(1);
  } else {
    console.log('✅ Adatbázis megnyitva!');
  }
});

// Ellenőrizzük, van-e tournament_players tábla
db.all('SELECT name FROM sqlite_master WHERE type="table"', (err, tables) => {
  if (err) {
    console.error('❌ Lekérdezési hiba:', err.message);
  } else {
    console.log('📋 Táblák az adatbázisban:', tables.map(t => t.name));
  }
});

// Listázzuk a csatlakozásokat (ha van ilyen tábla)
db.all('SELECT * FROM tournament_players', (err, rows) => {
  if (err) {
    console.error('⚠️ Nem található tournament_players tábla vagy hiba:', err.message);
  } else if (rows.length === 0) {
    console.log('ℹ️ A tournament_players tábla üres.');
  } else {
    console.log('✅ Tartalom a tournament_players táblában:');
    console.table(rows);
  }
  db.close();
});