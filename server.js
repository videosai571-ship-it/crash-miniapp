const express = require('express');
const crypto = require('crypto');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const BOT_TOKEN = process.env.9122790412:AAHKXZ3ttaovPya2ZFITSqA5InS0YEXPDc0 || '';
const PORT = process.env.PORT || 3000;

const users = new Map();
const active = new Map();

const K = 0.09;
const MIN_BET = 10;
const MAX_BET = 1000;

function verifyInitData(initData) {
  if (!initData || !BOT_TOKEN) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');
    const dataCheck = [...params.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `\( {k}= \){v}`)
      .join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calculated = crypto.createHmac('sha256', secret).update(dataCheck).digest('hex');
    if (calculated !== hash) return null;
    const user = JSON.parse(params.get('user') || '{}');
    return user.id ? String(user.id) : null;
  } catch {
    return null;
  }
}

function getUser(uid) {
  if (!users.has(uid)) {
    users.set(uid, { bal: 1000, hist: [], auto: 0, bet: 50 });
  }
  return users.get(uid);
}

function curMult(t) {
  return Math.exp(K * t);
}

app.post('/api/crash/state', (req, res) => {
  const uid = verifyInitData(req.body.initData);
  if (!uid) return res.json({ err: 'Auth xato' });
  const u = getUser(uid);
  const act = active.get(uid);
  res.json({
    k: K,
    min: MIN_BET,
    max: MAX_BET,
    bal: u.bal,
    auto: u.auto,
    bet: u.bet,
    autos: [0, 15, 20, 30, 50],
    hist: u.hist.slice(-12),
    active: act ? { t: (Date.now() - act.start) / 1000, bet: act.bet } : null
  });
});

app.post('/api/crash/start', (req, res) => {
  const uid = verifyInitData(req.body.initData);
  if (!uid) return res.json({ err: 'Auth xato' });
  const u = getUser(uid);
  const bet = Math.max(MIN_BET, Math.min(MAX_BET, Math.round(Number(req.body.bet) || u.bet)));
  const auto = Number(req.body.auto) || 0;

  if (active.has(uid)) return res.json({ err: 'Raund davom etmoqda' });
  if (u.bal < bet) return res.json({ err: 'Balans yetarli emas' });

  u.bal -= bet;
  u.bet = bet;
  u.auto = auto;

  const r = Math.random();
  const point = Math.max(1.01, Math.min(25, 0.97 / (1 - r * 0.97)));
  const crashAt = Math.log(point) / K;

  active.set(uid, {
    bet,
    auto,
    start: Date.now(),
    crashAt,
    point
  });

  res.json({ bal: u.bal });
});

app.post('/api/crash/cash', (req, res) => {
  const uid = verifyInitData(req.body.initData);
  if (!uid) return res.json({ err: 'Auth xato' });
  const act = active.get(uid);
  if (!act) return res.json({ err: 'Faol raund yo‘q' });

  const t = (Date.now() - act.start) / 1000;
  if (t >= act.crashAt) {
    finishCrash(uid, act);
    const u = getUser(uid);
    return res.json({ state: 'end', how: 'crash', point: act.point, bet: act.bet, bal: u.bal, hist: u.hist });
  }

  const mult = curMult(t);
  const payout = Math.floor(act.bet * mult);
  const u = getUser(uid);
  u.bal += payout;
  u.hist.push(Number(mult.toFixed(2)));
  if (u.hist.length > 30) u.hist.shift();
  active.delete(uid);

  res.json({
    state: 'end',
    how: 'cash',
    mult: Number(mult.toFixed(2)),
    point: act.point,
    bet: act.bet,
    payout,
    bal: u.bal,
    hist: u.hist
  });
});

app.post('/api/crash/poll', (req, res) => {
  const uid = verifyInitData(req.body.initData);
  if (!uid) return res.json({ err: 'Auth xato' });
  const act = active.get(uid);
  if (!act) return res.json({ state: 'idle' });

  const t = (Date.now() - act.start) / 1000;
  if (t >= act.crashAt) {
    finishCrash(uid, act);
    const u = getUser(uid);
    return res.json({
      state: 'end',
      how: 'crash',
      point: act.point,
      bet: act.bet,
      bal: u.bal,
      hist: u.hist
    });
  }

  if (act.auto > 0) {
    const mult = curMult(t);
    if (mult >= act.auto / 10) {
      const payout = Math.floor(act.bet * mult);
      const u = getUser(uid);
      u.bal += payout;
      u.hist.push(Number(mult.toFixed(2)));
      if (u.hist.length > 30) u.hist.shift();
      active.delete(uid);
      return res.json({
        state: 'end',
        how: 'auto',
        mult: Number(mult.toFixed(2)),
        point: act.point,
        bet: act.bet,
        payout,
        bal: u.bal,
        hist: u.hist
      });
    }
  }

  res.json({ state: 'run', t });
});

function finishCrash(uid, act) {
  const u = getUser(uid);
  u.hist.push(Number(act.point.toFixed(2)));
  if (u.hist.length > 30) u.hist.shift();
  active.delete(uid);
}

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log('Crash server ' + PORT + ' da ishlayapti'));
