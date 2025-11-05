
# QuizMaster – végleges csomag

## Telepítés
```bash
npm install
npm run init:db
npm run dev   # vagy: npm start
# böngésző: http://localhost:3000
```

## Fő funkciók
- Bejelentkezés / Regisztráció (10 000 játékzseton kezdésnek)
- Játékpénzes és **valódi pénzes** versenyek (buy-in -> prize pool)
- Versenylista → Csatlakozás → Lobby → **Játék**
- Beépített **póker-stílusú kvízjáték** animációkkal
- **Kérdések szerkeszthetők:** `data/questions.json`
- **Top 10% payout (lineáris):** a prize pool a legjobb 10%-nak kerül kiosztásra (1. hely a legtöbbet kapja), majd a verseny **törlődik**.

### Payout példa
30 induló → 3 díjazott, súlyok: 3,2,1 (össz: 6).  
Prize pool 60 000 Ft → 30 000 / 20 000 / 10 000 Ft.

## Háttérkép
Tedd a saját képedet ide: `public/img/bg.jpg` – a játék asztalán azonnal megjelenik.
