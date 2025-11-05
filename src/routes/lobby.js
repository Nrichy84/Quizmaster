import express from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// 🎯 Lobby megjelenítése
router.get('/lobby/:id', requireAuth, (req, res) => {
  const tid = parseInt(req.params.id);

  db.get(`SELECT * FROM tournaments WHERE id = ?`, [tid], (err, tournament) => {
    if (err || !tournament) {
      console.error('❌ Hiba: Nincs ilyen verseny.');
      return res.status(404).send('Nincs ilyen verseny.');
    }

    db.all(
      `SELECT u.username
       FROM tournament_players tp
       JOIN users u ON tp.user_id = u.id
       WHERE tp.tournament_id = ?`,
      [tid],
      (err2, players) => {
        if (err2) {
          console.error('⚠️ Hiba a játékosok lekérésénél:', err2.message);
          return res.status(500).send('Hiba a játékosok betöltésekor.');
        }

        res.render('lobby', {
          title: 'Lobby',
          tournament,
          players
        });
      }
    );
  });
});

export default router;