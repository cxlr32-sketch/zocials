const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname)));

const DB = {
  users: {},
  posts: [],
  chats: {},
  bank: {},
  subscriptions: {},
  verified: ['snzhk']
};

// Сохраняем посты каждые 30 секунд в памяти (они и так в памяти, просто для стабильности)
let lastBackup = Date.now();

// Пассивный доход + проценты по вкладам
setInterval(() => {
  const now = Date.now();
  Object.keys(DB.bank).forEach(username => {
    const b = DB.bank[username];
    if (!b) return;
    if (b.passiveLevel > 0) {
      b.balance += b.passiveLevel;
      b.history.push({ type: 'пассивный доход', amount: b.passiveLevel, time: new Date().toLocaleTimeString() });
    }
    if (b.depositAmount > 0 && b.depositTimer && now - b.depositTimer >= 30000) {
      const cycles = Math.floor((now - b.depositTimer) / 30000);
      const interest = Math.floor(b.depositAmount * 0.02 * cycles);
      if (interest > 0) {
        b.balance += interest;
        b.depositTimer = now;
        b.history.push({ type: 'проценты по вкладу', amount: interest, time: new Date().toLocaleTimeString() });
      }
    }
  });
}, 1000);

// Регистрация
app.post('/api/register', (req, res) => {
  const { name, username, password } = req.body;
  if (!name || !username || !password) return res.json({ error: 'заполните все поля' });
  if (username.length < 3) return res.json({ error: 'никнейм мин. 3 символа' });
  if (password.length < 4) return res.json({ error: 'пароль мин. 4 символа' });
  if (DB.users[username]) return res.json({ error: 'никнейм занят' });

  DB.users[username] = { name, username, password, avatar: null, bio: '' };
  DB.bank[username] = { balance: 100, clickLevel: 1, passiveLevel: 0, depositAmount: 0, depositTimer: 0, history: [], savingsBalance: 0 };
  DB.subscriptions[username] = [];

  res.json({ success: true, user: { name, username } });
});

// Вход
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = DB.users[username];
  if (!user) return res.json({ error: 'неверные данные' });
  if (user.password !== password) return res.json({ error: 'неверные данные' });
  res.json({ success: true, user: { name: user.name, username, avatar: user.avatar, bio: user.bio } });
});

// Проверка сессии
app.post('/api/session', (req, res) => {
  const { username } = req.body;
  const user = DB.users[username];
  if (!user) return res.json({ error: 'сессия недействительна' });
  res.json({ success: true, user: { name: user.name, username, avatar: user.avatar, bio: user.bio } });
});

// Обновление профиля
app.post('/api/profile/update', (req, res) => {
  const { username, name, bio, avatar } = req.body;
  const user = DB.users[username];
  if (!user) return res.json({ error: 'не найден' });
  if (name) user.name = name;
  if (bio !== undefined) user.bio = bio;
  if (avatar) user.avatar = avatar;
  res.json({ success: true, user: { name: user.name, username, avatar: user.avatar, bio: user.bio } });
});

// Посты
app.get('/api/posts', (req, res) => {
  const sorted = [...DB.posts].sort((a, b) => b.timestamp - a.timestamp);
  res.json(sorted);
});

app.post('/api/posts', (req, res) => {
  const { username, text, media, mediaType } = req.body;
  if (!text && !media) return res.json({ error: 'пустой пост' });

  const post = {
    id: 'p' + Date.now(),
    username,
    text: text || '',
    media: media || null,
    mediaType: mediaType || null,
    time: 'только что',
    timestamp: Date.now(),
    edited: false,
    likes: 0,
    likedBy: [],
    comments: []
  };

  DB.posts.push(post);
  res.json({ success: true, post });
});

// Редактирование поста
app.post('/api/posts/:id/edit', (req, res) => {
  const post = DB.posts.find(p => p.id === req.params.id);
  if (!post) return res.json({ error: 'пост не найден' });
  if (post.username !== req.body.username) return res.json({ error: 'не ваш пост' });
  
  post.text = req.body.text !== undefined ? req.body.text : post.text;
  post.media = req.body.media !== undefined ? req.body.media : post.media;
  post.mediaType = req.body.mediaType !== undefined ? req.body.mediaType : post.mediaType;
  post.edited = true;
  
  res.json({ success: true, post });
});

app.post('/api/posts/:id/like', (req, res) => {
  const post = DB.posts.find(p => p.id === req.params.id);
  if (!post) return res.json({ error: 'не найден' });

  const idx = post.likedBy.indexOf(req.body.username);
  if (idx > -1) { post.likedBy.splice(idx, 1); post.likes--; }
  else { post.likedBy.push(req.body.username); post.likes++; }

  res.json({ likes: post.likes, liked: post.likedBy.includes(req.body.username) });
});

app.post('/api/posts/:id/comment', (req, res) => {
  const post = DB.posts.find(p => p.id === req.params.id);
  if (!post) return res.json({ error: 'не найден' });
  post.comments.push({ author: req.body.username, text: req.body.text });
  res.json({ success: true });
});

app.delete('/api/posts/:id', (req, res) => {
  const idx = DB.posts.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.json({ error: 'не найден' });
  if (DB.posts[idx].username !== req.body.username) return res.json({ error: 'не ваш пост' });
  DB.posts.splice(idx, 1);
  res.json({ success: true });
});

// Верификация (только для snzhk)
app.post('/api/verify/toggle', (req, res) => {
  const { by, target } = req.body;
  if (by !== 'snzhk') return res.json({ error: 'нет прав' });
  const idx = DB.verified.indexOf(target);
  if (idx > -1) {
    DB.verified.splice(idx, 1);
    res.json({ verified: false });
  } else {
    DB.verified.push(target);
    res.json({ verified: true });
  }
});

app.get('/api/verified', (req, res) => {
  res.json(DB.verified);
});

// Банк
app.get('/api/bank/:username', (req, res) => {
  if (!DB.bank[req.params.username]) DB.bank[req.params.username] = { balance: 100, clickLevel: 1, passiveLevel: 0, depositAmount: 0, depositTimer: 0, history: [], savingsBalance: 0 };
  res.json(DB.bank[req.params.username]);
});

app.post('/api/bank/click', (req, res) => { const b = DB.bank[req.body.username]; if (!b) return res.json({ error: 'нет счёта' }); b.balance += b.clickLevel; b.history.push({ type: 'клик', amount: b.clickLevel, time: new Date().toLocaleTimeString() }); res.json({ balance: b.balance }); });
app.post('/api/bank/upgrade', (req, res) => { const b = DB.bank[req.body.username]; const cost = b.clickLevel * 2 * 50; if (b.balance < cost) return res.json({ error: 'недостаточно средств' }); b.balance -= cost; b.clickLevel++; b.history.push({ type: 'улучшение', amount: -cost, time: new Date().toLocaleTimeString() }); res.json({ balance: b.balance, clickLevel: b.clickLevel }); });
app.post('/api/bank/passive', (req, res) => { const b = DB.bank[req.body.username]; const cost = (b.passiveLevel + 1) * 100; if (b.balance < cost) return res.json({ error: 'недостаточно средств' }); b.balance -= cost; b.passiveLevel++; b.history.push({ type: 'покупка пассивного', amount: -cost, time: new Date().toLocaleTimeString() }); res.json({ balance: b.balance, passiveLevel: b.passiveLevel }); });
app.post('/api/bank/deposit', (req, res) => { const b = DB.bank[req.body.username]; const amount = parseInt(req.body.amount); if (!amount || amount < 100) return res.json({ error: 'мин. 100 🪙' }); if (b.balance < amount) return res.json({ error: 'недостаточно средств' }); b.balance -= amount; b.depositAmount = amount; b.depositTimer = Date.now(); b.history.push({ type: 'вклад', amount: -amount, time: new Date().toLocaleTimeString() }); res.json({ success: true }); });
app.post('/api/bank/withdraw', (req, res) => { const b = DB.bank[req.body.username]; if (!b.depositAmount) return res.json({ error: 'нет вклада' }); const amount = b.depositAmount; b.balance += amount; b.depositAmount = 0; b.depositTimer = 0; b.history.push({ type: 'снятие вклада', amount, time: new Date().toLocaleTimeString() }); res.json({ success: true }); });
app.post('/api/bank/savings/deposit', (req, res) => { const b = DB.bank[req.body.username]; const amount = parseInt(req.body.amount); if (!amount || amount < 500) return res.json({ error: 'мин. 500 🪙' }); if (b.balance < amount) return res.json({ error: 'недостаточно средств' }); b.balance -= amount; b.savingsBalance = (b.savingsBalance || 0) + amount; b.history.push({ type: 'сбережения', amount: -amount, time: new Date().toLocaleTimeString() }); res.json({ success: true, savingsBalance: b.savingsBalance }); });
app.post('/api/bank/savings/withdraw', (req, res) => { const b = DB.bank[req.body.username]; if (!b.savingsBalance || b.savingsBalance <= 0) return res.json({ error: 'нет сбережений' }); const amount = b.savingsBalance; b.balance += amount; b.savingsBalance = 0; b.history.push({ type: 'снятие сбережений', amount, time: new Date().toLocaleTimeString() }); res.json({ success: true, savingsBalance: 0 }); });
app.post('/api/bank/transfer', (req, res) => { const { from, to, amount } = req.body; const s = DB.bank[from], r = DB.bank[to]; if (!s || !r) return res.json({ error: 'пользователь не найден' }); if (s.balance < amount) return res.json({ error: 'недостаточно средств' }); s.balance -= amount; r.balance += amount; s.history.push({ type: 'перевод', amount: -amount, time: new Date().toLocaleTimeString() }); r.history.push({ type: 'получено', amount, time: new Date().toLocaleTimeString() }); if (!DB.chats[to]) DB.chats[to] = {}; if (!DB.chats[from]) DB.chats[from] = {}; const msg = { from, text: `💰 перевёл ${amount} 🪙`, time: new Date().toLocaleTimeString() }; if (!DB.chats[to][from]) DB.chats[to][from] = []; if (!DB.chats[from][to]) DB.chats[from][to] = []; DB.chats[to][from].push(msg); DB.chats[from][to].push(msg); res.json({ success: true }); });

// Чаты
app.get('/api/chat/:username', (req, res) => res.json(DB.chats[req.params.username] || {}));
app.post('/api/chat/send', (req, res) => { const { from, to, text } = req.body; if (!from || !to || !text) return res.json({ error: 'заполните все поля' }); if (!DB.chats[to]) DB.chats[to] = {}; if (!DB.chats[from]) DB.chats[from] = {}; if (!DB.chats[to][from]) DB.chats[to][from] = []; if (!DB.chats[from][to]) DB.chats[from][to] = []; const msg = { from, text, time: new Date().toLocaleTimeString() }; DB.chats[to][from].push(msg); DB.chats[from][to].push(msg); res.json({ success: true }); });

// Подписки
app.get('/api/subs/:username', (req, res) => res.json(DB.subscriptions[req.params.username] || []));
app.post('/api/subs/toggle', (req, res) => { const { subscriber, target } = req.body; if (!DB.subscriptions[subscriber]) DB.subscriptions[subscriber] = []; const idx = DB.subscriptions[subscriber].indexOf(target); idx > -1 ? DB.subscriptions[subscriber].splice(idx, 1) : DB.subscriptions[subscriber].push(target); res.json({ subscribed: idx === -1 }); });

// Пользователи
app.get('/api/users', (req, res) => res.json(Object.keys(DB.users).map(u => ({ username: u, name: DB.users[u].name, avatar: DB.users[u].avatar }))));
app.get('/api/users/search', (req, res) => { const q = (req.query.q || '').toLowerCase().trim(); if (!q) return res.json([]); const results = Object.keys(DB.users).filter(u => u.toLowerCase().includes(q) || (DB.users[u].name || '').toLowerCase().includes(q)).slice(0, 10).map(u => ({ username: u, name: DB.users[u].name, avatar: DB.users[u].avatar })); res.json(results); });
app.get('/api/users/:username', (req, res) => { const u = DB.users[req.params.username]; if (!u) return res.json({ error: 'не найден' }); res.json({ username: req.params.username, name: u.name, avatar: u.avatar, bio: u.bio }); });

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

module.exports = app;
if (require.main === module) app.listen(process.env.PORT || 3000, () => console.log('Zocial OK'));
