const express = require('express');
const router = express.Router();
const db = require('../db');

// Versenyek listázása
router.get('/tournaments', (req, res) => {
  db.all('SELECT * FROM tournaments ORDER BY start_time ASC', [], (err, rows) => {
    if (err) return res.status(500).send('Hiba a versenyek lekérdezésekor.');
    const tournaments = rows.map(t => ({
      ...t,
      prize_pool: t.entry_fee * t.player_count
    }));
    res.render('admin-tournaments', { title: 'Versenyek kezelése', tournaments });
  });
});

// Új verseny hozzáadása
router.post('/tournaments/add', (req, res) => {
  const { name, entry_fee, start_time } = req.body;
  db.run(
    'INSERT INTO tournaments (name, entry_fee, start_time) VALUES (?, ?, ?)',
    [name, entry_fee, start_time],
    err => {
      if (err) return res.status(500).send('Hiba a mentés során.');
      res.redirect('/admin/tournaments');
    }
  );
});

// Verseny törlése
router.get('/tournaments/delete/:id', (req, res) => {
  db.run('DELETE FROM tournaments WHERE id = ?', [req.params.id], err => {
    if (err) return res.status(500).send('Törlési hiba.');
    res.redirect('/admin/tournaments');
  });
});

// Verseny szerkesztése (GET)
router.get('/tournaments/edit/:id', (req, res) => {
  db.get('SELECT * FROM tournaments WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).send('Hiba.');
    res.render('edit-tournament', { title: 'Verseny szerkesztése', tournament: row });
  });
});

// Verseny szerkesztése (POST)
router.post('/tournaments/edit/:id', (req, res) => {
  const { name, entry_fee, start_time, player_count } = req.body;
  db.run(
    'UPDATE tournaments SET name=?, entry_fee=?, start_time=?, player_count=? WHERE id=?',
    [name, entry_fee, start_time, player_count, req.params.id],
    err => {
      if (err) return res.status(500).send('Mentési hiba.');
      res.redirect('/admin/tournaments');
    }
  );
});

module.exports = router;
