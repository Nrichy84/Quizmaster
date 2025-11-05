import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';

const router = express.Router();

// Bejelentkezés oldal
router.get('/login', (req, res) => {
  res.render('login', { title: 'Bejelentkezés' });
});

// Bejelentkezés feldolgozása
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
    if (err || !user) {
      return res.render('login', { title: 'Bejelentkezés', error: 'Hibás adatok.' });
    }

    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.render('login', { title: 'Bejelentkezés', error: 'Hibás adatok.' });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      tokens: user.tokens,
      credits: user.credits
    };

    res.redirect('/dashboard');
  });
});

// 🟩 Regisztrációs oldal megjelenítése
router.get('/register', (req, res) => {
  res.render('register', { title: 'Regisztráció' });
});

// 🟩 Regisztráció feldolgozása
router.post('/register', (req, res) => {
  const { username, password } = req.body;
  console.log('📩 Beérkező regisztrációs adatok:', { username, password });

  if (!username || !password) {
    console.log('⚠️ Hiányzó adat!');
    return res.render('register', { title: 'Regisztráció', error: 'Kérlek, tölts ki minden mezőt!' });
  }

  const hash = bcrypt.hashSync(password, 10);
  console.log('🔐 Hash elkészült:', hash);

  console.log('🟡 Adatbázisba írás előkészítve...');
  db.run(
    `INSERT INTO users (username, password_hash, tokens, credits) VALUES (?, ?, 10000, 0)`,
    [username.trim(), hash],
    function (err) {
      console.log('🟢 db.run callback elindult.');
      if (err) {
        console.error('❌ Regisztrációs hiba:', err);
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.render('register', {
            title: 'Regisztráció',
            error: 'Ez a felhasználónév már létezik. Válassz másikat!'
          });
        }
        return res.render('register', {
          title: 'Regisztráció',
          error: 'Adatbázis hiba történt a regisztráció során.'
        });
      }

      console.log('✅ Új felhasználó létrehozva:', username);
      req.session.user = { id: this.lastID, username, tokens: 10000, credits: 0 };
      return res.redirect('/dashboard');
    }
  );
});

// Kijelentkezés
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

export default router;