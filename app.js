import express from 'express';
import session from 'express-session';
import path from 'path';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import expressLayouts from 'express-ejs-layouts';
import { fileURLToPath } from 'url';
import http from 'http';
import { Server } from 'socket.io';
import questions from './src/questions.js';

import authRoutes from './src/routes/auth.js';
import tournamentRoutes from './src/routes/tournaments.js';
import playRoutes from './src/routes/play.js';
import adminRoutes from './src/routes/admin.js';
import lobbyRoutes from './src/routes/lobby.js';
import db from './src/db.js';

// Path fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Express
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Session
app.use(
    session({
        secret: 'quizmaster_secret',
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 24 * 60 * 60 * 1000 },
    })
);

// Locals
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// Routes
app.get('/', (req, res) => res.render('index', { title: 'QuizMaster' }));
app.get('/dashboard', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render('dashboard', { title: 'Főoldal' });
});

app.use(authRoutes);
app.use(tournamentRoutes);
app.use(playRoutes);
app.use(adminRoutes);
app.use(lobbyRoutes);

// --- HTTP + Socket.IO ---
const port = process.env.PORT || 3000;
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
});

/* ============================================================
   ===============  MULTIPLAYER JÁTÉK LOGIKA ==================
   ============================================================ */

const rooms = {};           // szobák állapota
const roomAnswers = {};     // válaszok ide gyűlnek

function getRoomName(tid) {
    return `tournament_${tid}`;
}

function pickRandomQuestion() {
    return questions[Math.floor(Math.random() * questions.length)];
}

/* -------------------- SOCKET.IO -------------------- */
io.on("connection", (socket) => {
    console.log("🔌 Socket connect:", socket.id);

    const { username, tournamentId } = socket.handshake.query;
    if (!username || !tournamentId) return;

    const roomName = getRoomName(tournamentId);
    socket.join(roomName);
    socket.username = username;

    // Szoba inicializálás
    if (!rooms[roomName]) {
        rooms[roomName] = {
            players: [],
            stake: 10,
            pot: 0,
            currentQuestion: null,
            started: false,
            raiseTimer: null,
            tournamentId: parseInt(tournamentId),
            inBreak: false,
        };
    }

    const rs = rooms[roomName];

    // Játékos hozzáadása
    if (!rs.players.some(p => p.username === username)) {
        rs.players.push({
            username,
            points: 100,
            active: true,
        });
    }

    // Friss lista küldése
    io.in(roomName).emit("currentPlayers", rs.players);

    // Tét duplázó TIMER csak egyszer indul
    if (!rs.raiseTimer) {
        rs.raiseTimer = setInterval(() => {
            rs.stake *= 2;
            console.log(`♻️ Tét duplázva ${roomName}: ${rs.stake}`);
        }, 10 * 60 * 1000);
    }

    // Ha legalább 2 aktív játékos van: start
    if (!rs.started && rs.players.filter(p => p.active).length >= 2) {
        rs.started = true;
        sendNewQuestion(roomName);
    }

    /* ------------- Válasz fogadása ------------- */
    socket.on("playerAnswer", ({ answerIndex }) => {
        if (!rs.currentQuestion) return;

        if (!roomAnswers[roomName]) roomAnswers[roomName] = [];
        if (roomAnswers[roomName].some(a => a.username === username)) return;

        roomAnswers[roomName].push({ username, answerIndex });

        const need = rs.players.filter(p => p.active).length;
        if (roomAnswers[roomName].length >= need) {
            calculateResults(roomName);
        }
    });

    socket.on("disconnect", () => {
        console.log(`❌ Disconnect: ${username}`);
    });
});

/* ------------------- Új kérdés -------------------- */
function sendNewQuestion(roomName) {
    const rs = rooms[roomName];
    if (!rs) return;
    
    rs.hasStartedAtLeastOnce = true;  // <<< EZ KELL

    // ⏸ Ha szünet van, nem küldünk új kérdést
    if (rs.inBreak) {
        console.log(`⏸ Szünet alatt nincs új kérdés: ${roomName}`);
        return;
    }

    const alive = rs.players.filter(p => p.active);
    if (alive.length <= 1) return finishGame(roomName);

    const q = pickRandomQuestion();
    rs.currentQuestion = q;
    roomAnswers[roomName] = [];

    io.in(roomName).emit("newQuestion", {
        q: q.q,
        a: q.a,
        correctIndex: q.correct
    });
}

/* ------------------- Eredmény számítás -------------------- */
function calculateResults(roomName) {
    const rs = rooms[roomName];
    const answers = roomAnswers[roomName];
    const correctIndex = rs.currentQuestion.correct;

    let addedToPot = 0;

    // Minden aktív játékos fizet
    rs.players.forEach(p => {
        if (!p.active) return;

        const pay = Math.min(p.points, rs.stake);
        p.points -= pay;

        if (p.points <= 0) {
            p.points = 0;
            p.active = false;
        }
// Ha kiesett: helyezés számítás + top10% nyeremény
if (!p.active) {

    // Helyezés meghatározása
    const rankedNow = [...rs.players]
        .sort((a, b) => b.points - a.points);
    const rankIndex = rankedNow.findIndex(x => x.username === p.username) + 1;
    const totalPlayers = rankedNow.length;

    // top10% nyeremény
    const cutoff = Math.ceil(totalPlayers * 0.10);

    let prize = 0;
    if (rankIndex <= cutoff) {
        // db-ből szerezzük a prize_pool-t
        db.get(
            `SELECT prize_pool FROM tournaments WHERE id = ?`,
            [rs.tournamentId],
            (err, row) => {
                if (!err && row) {
                    prize = Math.floor(row.prize_pool / cutoff);

                    // DB jóváírás
                    db.run(
                        `UPDATE users SET tokens = tokens + ? WHERE username = ?`,
                        [prize, p.username]
                    );
                }

                // Kiestél event KÜLDÉSE
                io.to(roomName).emit("youAreOut", {
                    username: p.username,
                    rank: rankIndex,
                    total: totalPlayers,
                    prize
                });
            }
        );
    } else {
        // Nincs nyeremény (nem top10%)
        io.to(roomName).emit("youAreOut", {
            username: p.username,
            rank: rankIndex,
            total: totalPlayers,
            prize: 0
        });
    }
}

        addedToPot += pay;
    });

    rs.pot += addedToPot;

    // Helyes megfejtők
    const results = rs.players.map(p => {
        const a = answers.find(x => x.username === p.username);
        const correct = a && a.answerIndex === correctIndex;
        return { username: p.username, correct, points: p.points, active: p.active };
    });

    const winners = results.filter(r => r.correct && r.active);
    let share = 0;

    if (winners.length > 0) {
        share = Math.floor(rs.pot / winners.length);

        winners.forEach(r => {
            const p = rs.players.find(x => x.username === r.username);
            p.points += share;
        });

        rs.pot -= share * winners.length;
    }

    io.in(roomName).emit("playerResult", {
        results,
        share,
        stake: rs.stake,
        pot: rs.pot,
        players: rs.players,
        correctIndex
    });

    if (rs.players.filter(p => p.active).length <= 1) {
        finishGame(roomName);
        return;
    }

    setTimeout(() => sendNewQuestion(roomName), 5000);
}

/* ------------------- Játék vége -------------------- */
function finishGame(roomName) {
    const rs = rooms[roomName];
    if (!rs) return;

    const ranked = [...rs.players].sort((a, b) => b.points - a.points);

    const alive = ranked.filter(p => p.points > 0);
    const total = ranked.length;

    // 🔥 Top10% + 1 fő alatti speciális szabály
    let winners = [];

    if (total < 10) {
        winners = [ranked[0]]; // 10 fő alatt egy nyertes
    } else {
        const topCount = Math.max(1, Math.floor(total * 0.10));
        winners = ranked.slice(0, topCount);
    }

    // Prize pool lekérése
    db.get(
        `SELECT prize_pool FROM tournaments WHERE id = ?`,
        [rs.tournamentId],
        (err, row) => {
            if (err || !row) return;

            const prize = row.prize_pool;
            const share = Math.floor(prize / winners.length);

            // Nyertesek frissítése DB-ben
            winners.forEach(w => {
                db.run(
                    `UPDATE users SET tokens = tokens + ? WHERE username = ?`,
                    [share, w.username]
                );
            });

            io.to(roomName).emit("gameOver", {
                winners: winners.map(w => w.username),
                rewardEach: share,
                prizePool: prize,
                ranked
            });
        }
    );

    clearInterval(rs.raiseTimer);

    delete rooms[roomName];
    delete roomAnswers[roomName];
}
// ====== PONTOS ÓRÁNKÉNTI SZÜNET (HH:50–HH:59) ======
setInterval(() => {
    const now = new Date();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    // Számoljuk, hogy szünet van-e MOST
    const inBreakNow = minutes >= 50; // 50:00 → 59:59

    for (const [roomName, rs] of Object.entries(rooms)) {
        if (!rs) continue;

        // Biztonság kedvéért inicializáljuk
        if (rs.inBreak === undefined) rs.inBreak = false;

        // ========== SZÜNET INDUL ==========
        if (inBreakNow && rs.inBreak === false) {

            rs.inBreak = true;
            console.log(`⏸ Szünet indul: ${roomName}`);

            // hátralévő idő a következő óra 00:00-ig
            const secondsLeft = ((59 - minutes) * 60) + (60 - seconds);

            io.to(roomName).emit("breakStart", { secondsLeft });

            // Játék leállítása
            rs.currentQuestion = null;
            roomAnswers[roomName] = [];
        }

        // ========== SZÜNET VÉGE ==========
        if (!inBreakNow && rs.inBreak === true) {

            rs.inBreak = false;
            console.log(`▶️ Szünet vége: ${roomName}`);

            io.to(roomName).emit("breakEnd");

            // ha lehet, új kérdés
            if (
                rs.players.filter(p => p.active).length >= 2 &&
                !rs.currentQuestion
            ) {
                sendNewQuestion(roomName);
            }
        }
    }
}, 1000);

/* ------------------- Start -------------------- */
server.listen(port, () => {
    console.log(`🔥 Quizmaster multiplayer fut: http://localhost:${port}`);
});