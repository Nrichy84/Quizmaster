import express from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// 🟢 ADMIN OLDAL – Versenyek listázása
router.get('/admin/tournaments', requireAuth, (req, res) => {
  db.all(`SELECT * FROM tournaments ORDER BY datetime(start_time) ASC`, (err, rows) => {
    if (err) {
      console.error('❌ Hiba a versenyek lekérésekor:', err.message);
      return res.status(500).send('Hiba történt az adatbázis lekérésekor.');
    }

    const playmoney = rows.filter(t => t.type === 'free');
    const freeroll = rows.filter(t => t.type === 'freeroll');
    const buyin = rows.filter(t => t.type === 'buyin');

    console.log('📋 Versenyek betöltve:', {
      playmoney: playmoney.length,
      freeroll: freeroll.length,
      buyin: buyin.length
    });

    res.render('admin_tournaments', {
      title: 'Versenyek kezelése',
      playmoney,
      freeroll,
      buyin
    });
  });
});

// 🟢 ÚJ VERSENY LÉTREHOZÁSA
router.post('/admin/tournaments', (req, res) => {
  const { name, type, entry_fee, start_time } = req.body;

  console.log('📝 Beérkező adatok:', { name, type, entry_fee, start_time });

  if (!name || !type || !start_time) {
    console.log('⚠️ Hiányzó adat!');
    return res.status(400).send('Hiányzó adatok a létrehozáshoz.');
  }

  // ✅ Egységesített típusnevek
  const normalizedType =
    type === 'Play Money' ? 'free' :
    type === 'Freeroll' ? 'freeroll' :
    type === 'Buy-in' ? 'buyin' :
    type.toLowerCase();

  db.run(
    `INSERT INTO tournaments (name, type, entry_fee, start_time, player_count, prize_pool, status)
     VALUES (?, ?, ?, ?, 0, 0, 'scheduled')`,
    [name, normalizedType, entry_fee || 0, start_time],
    function (err) {
      if (err) {
        console.error('❌ Hiba a létrehozás során:', err.message);
        return res.status(500).send('Nem sikerült a verseny létrehozása.');
      }

      console.log(`✅ Verseny sikeresen létrehozva: "${name}" [${normalizedType}]`);
      res.redirect('/admin/tournaments');
    }
  );
});

// 🟢 VERSENY TÖRLÉSE
router.post('/admin/tournaments/:id/delete', requireAuth, (req, res) => {
  const id = req.params.id;

  db.run(`DELETE FROM tournaments WHERE id = ?`, [id], (err) => {
    if (err) {
      console.error('❌ Törlési hiba:', err.message);
      return res.status(500).send('Nem sikerült törölni a versenyt.');
    }

    console.log(`🗑️ Verseny törölve, ID: ${id}`);
    res.redirect('/admin/tournaments');
  });
});

export default router;