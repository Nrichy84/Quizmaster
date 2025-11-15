import express from 'express';
import session from 'express-session';
import path from 'path';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import expressLayouts from 'express-ejs-layouts';
import { fileURLToPath } from 'url';

import authRoutes from './src/routes/auth.js';
import tournamentRoutes from './src/routes/tournaments.js';
import playRoutes from './src/routes/play.js';
import adminRoutes from './src/routes/admin.js';   // ✅ új admin útvonal
import db from './src/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.static(path.join(__dirname, '..', 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(expressLayouts);
app.set('layout', 'layout');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


app.use(cookieParser());

app.use(session({
    secret: 'quizmaster_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000 // 1 napig érvényes session
    }
}));
// ensure DB (átmenetileg kikommentelve, amíg nincs migrációs rendszer)
// await runMigrations();
// await seedTournaments();
// ensureUpgrades();

// locals
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// routes
app.get('/', (req, res) => res.render('index', { title: 'QuizMaster' }));
app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('dashboard', { title: 'Főoldal' });
});

app.use(authRoutes);
app.use(tournamentRoutes);
app.use(playRoutes);
app.use(adminRoutes);   // ✅ hozzáadva az admin route
import lobbyRoutes from './src/routes/lobby.js';
app.use(lobbyRoutes);

app.use(express.json());

// 💰 Nyeremény jóváírás endpoint (DB-be mentés)
app.post('/api/addwinnings', (req, res) => {
  console.log('➡️ /api/addwinnings hívás érkezett.');
  console.log('📦 Request body:', req.body);

  const { name, amount } = req.body;
  console.log(`💰 Nyeremény érkezett: ${name} +${amount} zseton`);

  if (!name || !amount) {
    console.error('❌ Hiányzó adatok a kérelemből!');
    return res.status(400).json({ success: false, error: 'Hiányzó adatok!' });
  }

  try {
    db.run(
      `UPDATE users SET tokens = tokens + ? WHERE username = ?`,
      [amount, name],
      (err) => {
        if (err) {
          console.error('❌ Hiba a jóváírásnál:', err.message);
          res.status(500).json({ success: false, error: err.message });
        } else {
          console.log(`✅ Jóváírva ${amount} zseton ${name} felhasználónak.`);
          res.json({ success: true, message: 'Nyeremény mentve', amount });
        }
      }
    );
  } catch (err) {
    console.error('⚠️ Kivétel a jóváírás közben:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 404
app.use((req, res) => res.status(404).send('404 - Nincs ilyen oldal.'));

const port = process.env.PORT || 3000;


app.listen(port, () => console.log(`Quizmaster listening on http://localhost:${port}`));
