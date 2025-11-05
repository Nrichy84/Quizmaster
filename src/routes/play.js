import express from 'express';
import db from '../db.js';              // ✅ csak a db-t importáljuk, nem getDb-t
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/play/:id', requireAuth, (req, res) => {
  const tid = req.params.id;

  db.get(`SELECT * FROM tournaments WHERE id = ?`, [tid], (err, tournament) => {
    if (err || !tournament) {
      return res.status(404).send('Nincs ilyen verseny.');
    }

    res.render('play', {
      title: 'Játék',
      t: tournament
    });
  });
});

export default router;
