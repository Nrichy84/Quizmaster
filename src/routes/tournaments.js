import express from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// 🟢 Versenyek listázása típus szerint
router.get('/tournaments', requireAuth, (req, res) => {
  const type = req.query.type || 'free';
  const normalizedType =
    type === 'Play Money' ? 'free' :
    type === 'Freeroll'   ? 'freeroll' :
    type === 'Buy-in'     ? 'buyin'    :
    type.toLowerCase();

  const sql = `
    SELECT
      t.*,
      (SELECT COUNT(*) FROM tournament_players tp WHERE tp.tournament_id = t.id) AS joined_players,
      (t.entry_fee * (SELECT COUNT(*) FROM tournament_players tp2 WHERE tp2.tournament_id = t.id)) AS computed_prize
    FROM tournaments t
    WHERE t.type = ?
    ORDER BY datetime(t.start_time) ASC
  `;

  db.all(sql, [normalizedType], (err, tournaments) => {
    if (err) {
      console.error('❌ Hiba a versenyek lekérésekor:', err.message);
      return res.status(500).send('Hiba történt az adatbázis lekérésekor.');
    }

    db.all(
      `SELECT tournament_id FROM tournament_players WHERE user_id = ?`,
      [req.session.user.id],
      (err2, joined) => {
        const joinedIds = joined ? joined.map(j => j.tournament_id) : [];
        res.render('tournaments', {
          title: 'Versenyek',
          tournaments,
          type: normalizedType,
          joinedIds
        });
      }
    );
  });
});

// 🟢 Csatlakozás egy versenyhez
router.post('/tournaments/:id/join', requireAuth, (req, res) => {
  const tid = parseInt(req.params.id);
  const userId = req.session.user.id;

  db.get(`SELECT * FROM tournaments WHERE id = ?`, [tid], (err, tournament) => {
    console.log('🎯 Verseny betöltve:', tournament);
    if (err || !tournament) {
      console.error('❌ Hiba a verseny lekérésekor:', err?.message);
      return res.status(404).json({ ok: false, error: 'Nincs ilyen verseny.' });
    }

    // Ellenőrizzük, hogy már csatlakozott-e
    db.get(
      `SELECT * FROM tournament_players WHERE user_id = ? AND tournament_id = ?`,
      [userId, tid],
      (checkErr, existing) => {
        if (existing) {
          console.log('⚠️ Már csatlakozott korábban.');
          return res.json({ ok: true, alreadyJoined: true });
        }

        const balanceField = tournament.type === 'free' ? 'tokens' : 'credits';

        // Ha van nevezési díj
        if (tournament.entry_fee > 0) {
          db.get(
            `SELECT ${balanceField} AS balance FROM users WHERE id = ?`,
            [userId],
            (e2, user) => {
              if (e2 || !user)
                return res
                  .status(500)
                  .json({ ok: false, error: 'Felhasználó hiba.' });

              if (user.balance < tournament.entry_fee)
                return res
                  .status(400)
                  .json({ ok: false, error: 'Nincs elég egyenleg a nevezéshez.' });

              // Levonjuk a nevezési díjat
              db.run(
                `UPDATE users SET ${balanceField} = ${balanceField} - ? WHERE id = ?`,
                [tournament.entry_fee, userId],
                err3 => {
                  if (err3) {
                    return res
                      .status(500)
                      .json({ ok: false, error: 'Nem sikerült levonni a nevezési díjat.' });
                  }

                  // 🔄 Frissítjük a session-ben is
                  req.session.user[balanceField] =
                    (req.session.user[balanceField] || 0) - tournament.entry_fee;

                  // Hozzáadjuk a játékost
                  addPlayerToTournament(balanceField);
                }
              );
            }
          );
        } else {
          addPlayerToTournament(balanceField);
        }

        // --- BELSŐ FÜGGVÉNY ---
        function addPlayerToTournament(balanceField) {
          db.run(
            `INSERT INTO tournament_players (user_id, tournament_id) VALUES (?, ?)`,
            [userId, tid],
            err4 => {
              if (err4) {
                console.error('❌ Hiba a csatlakozásnál:', err4.message);
                return res
                  .status(500)
                  .json({ ok: false, error: 'Adatbázis hiba.' });
              }

              db.run(`UPDATE tournaments SET player_count = player_count + 1 WHERE id = ?`, [tid]);
              if (tournament.entry_fee > 0) {
                db.run(`UPDATE tournaments SET prize_pool = prize_pool + ? WHERE id = ?`, [tournament.entry_fee, tid]);
              }

              console.log(`✅ ${req.session.user.username} csatlakozott a versenyhez (#${tid})`);
              return res.json({
                ok: true,
                alreadyJoined: false,
                newBalance: req.session.user[balanceField]
              });
            }
          );
        }
      }
    );
  });
});

// 🟢 Játékoldal megjelenítése
router.get('/game/:id', requireAuth, (req, res) => {
  const tid = parseInt(req.params.id);

  db.get(`SELECT * FROM tournaments WHERE id = ?`, [tid], (err, tournament) => {
    if (err || !tournament) {
      return res.status(404).send('404 - Nincs ilyen verseny.');
    }

    res.render('game', {
      title: `${tournament.name} - Játék`,
      tournament
    });
  });
});

export default router;