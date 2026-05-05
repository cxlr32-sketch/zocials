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
  subscriptions: {}
};

// Пассивный доход + проценты по вкладам
setInterval(() => {
  Object.keys(DB.bank).forEach(username => {
    const b = DB.bank[username];
    if (!b) return;
    if (b.passiveLevel > 0) b.balance += b.passiveLevel;
    if (b.depositAmount > 0 && b.depositTimer && Date.now() - b.depositTimer >= 30000) {
      const cycles = Math.floor((Date.now() - b.depositTimer) / 30000);
      const interest = Math.floor(b.depositAmount * 0.02 * cycles);
      if (interest > 0) {
        b.balance += interest;
        b.depositTimer = Date.now();
        b.history.push({ type: 'проценты', amount: interest, time: new Date().toLocaleTimeString() });
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
  DB.bank[username] = { balance: 100, clickLevel: 1, passiveLevel: 0, depositAmount: 0, depositTimer: 0, history: [] };
  DB.subscriptions[username] = [];

  res.json({ success: true, user: { name, username } });
});

// Вход
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = DB.users[username];
  if (!user || user.password !== password) return res.json({ error: 'неверные данные' });
  res.json({ success: true, user: { name: user.name, username } });
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
    likes: 0,
    likedBy: [],
    comments: []
  };

  DB.posts.push(post);
  res.json({ success: true, post });
});

app.post('/api/posts/:id/like', (req, res) => {
  const post = DB.posts.find(p => p.id === req.params.id);
  if (!post) return res.json({ error: 'пост не найден' });

  const idx = post.likedBy.indexOf(req.body.username);
  if (idx > -1) { post.likedBy.splice(idx, 1); post.likes--; }
  else { post.likedBy.push(req.body.username); post.likes++; }

  res.json({ likes: post.likes, liked: post.likedBy.includes(req.body.username) });
});

app.post('/api/posts/:id/comment', (req, res) => {
  const post = DB.posts.find(p => p.id === req.params.id);
  if (!post) return res.json({ error: 'пост не найден' });
  post.comments.push({ author: req.body.username, authorName: req.body.authorName, text: req.body.text });
  res.json({ success: true });
});

app.delete('/api/posts/:id', (req, res) => {
  const idx = DB.posts.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.json({ error: 'не найден' });
  if (DB.posts[idx].username !== req.body.username) return res.json({ error: 'не ваш пост' });
  DB.posts.splice(idx, 1);
  res.json({ success: true });
});

// Банк
app.get('/api/bank/:username', (req, res) => {
  if (!DB.bank[req.params.username]) DB.bank[req.params.username] = { balance: 100, clickLevel: 1, passiveLevel: 0, depositAmount: 0, depositTimer: 0, history: [] };
  res.json(DB.bank[req.params.username]);
});

app.post('/api/bank/click', (req, res) => {
  const b = DB.bank[req.body.username];
  if (!b) return res.json({ error: 'нет счёта' });
  b.balance += b.clickLevel;
  b.history.push({ type: 'клик', amount: b.clickLevel, time: new Date().toLocaleTimeString() });
  res.json({ balance: b.balance, clickLevel: b.clickLevel });
});

app.post('/api/bank/upgrade', (req, res) => {
  const b = DB.bank[req.body.username];
  const cost = b.clickLevel * 2 * 50;
  if (b.balance < cost) return res.json({ error: 'недостаточно средств' });
  b.balance -= cost; b.clickLevel++;
  b.history.push({ type: 'улучшение', amount: -cost, time: new Date().toLocaleTimeString() });
  res.json({ balance: b.balance, clickLevel: b.clickLevel });
});

app.post('/api/bank/passive', (req, res) => {
  const b = DB.bank[req.body.username];
  const cost = (b.passiveLevel + 1) * 100;
  if (b.balance < cost) return res.json({ error: 'недостаточно средств' });
  b.balance -= cost; b.passiveLevel++;
  b.history.push({ type: 'пассивный', amount: -cost, time: new Date().toLocaleTimeString() });
  res.json({ balance: b.balance, passiveLevel: b.passiveLevel });
});

app.post('/api/bank/deposit', (req, res) => {
  const b = DB.bank[req.body.username];
  const amount = parseInt(req.body.amount);
  if (!amount || amount < 100) return res.json({ error: 'мин. 100 🪙' });
  if (b.balance < amount) return res.json({ error: 'недостаточно средств' });
  if (b.depositAmount > 0) return res.json({ error: 'уже есть вклад' });
  b.balance -= amount; b.depositAmount = amount; b.depositTimer = Date.now();
  b.history.push({ type: 'вклад', amount: -amount, time: new Date().toLocaleTimeString() });
  res.json({ success: true });
});

app.post('/api/bank/withdraw', (req, res) => {
  const b = DB.bank[req.body.username];
  if (!b.depositAmount) return res.json({ error: 'нет вклада' });
  const amount = b.depositAmount;
  b.balance += amount; b.depositAmount = 0; b.depositTimer = 0;
  b.history.push({ type: 'снятие', amount, time: new Date().toLocaleTimeString() });
  res.json({ success: true });
});

app.post('/api/bank/transfer', (req, res) => {
  const { from, to, amount } = req.body;
  const sender = DB.bank[from], receiver = DB.bank[to];
  if (!sender || !receiver) return res.json({ error: 'пользователь не найден' });
  if (sender.balance < amount) return res.json({ error: 'недостаточно средств' });
  sender.balance -= amount; receiver.balance += amount;
  sender.history.push({ type: 'перевод', amount: -amount, time: new Date().toLocaleTimeString() });
  receiver.history.push({ type: 'получено', amount, time: new Date().toLocaleTimeString() });
  // Чат
  if (!DB.chats[to]) DB.chats[to] = {};
  if (!DB.chats[from]) DB.chats[from] = {};
  const msg = { from, text: `💰 перевёл ${amount} 🪙`, time: new Date().toLocaleTimeString() };
  if (!DB.chats[to][from]) DB.chats[to][from] = [];
  if (!DB.chats[from][to]) DB.chats[from][to] = [];
  DB.chats[to][from].push(msg); DB.chats[from][to].push(msg);
  res.json({ success: true });
});

// Чаты
app.get('/api/chat/:username', (req, res) => res.json(DB.chats[req.params.username] || {}));
app.post('/api/chat/send', (req, res) => {
  const { from, to, text } = req.body;
  if (!DB.chats[to]) DB.chats[to] = {}; if (!DB.chats[from]) DB.chats[from] = {};
  if (!DB.chats[to][from]) DB.chats[to][from] = []; if (!DB.chats[from][to]) DB.chats[from][to] = [];
  const msg = { from, text, time: new Date().toLocaleTimeString() };
  DB.chats[to][from].push(msg); DB.chats[from][to].push(msg);
  res.json({ success: true });
});

// Подписки
app.get('/api/subs/:username', (req, res) => res.json(DB.subscriptions[req.params.username] || []));
app.post('/api/subs/toggle', (req, res) => {
  const { subscriber, target } = req.body;
  if (!DB.subscriptions[subscriber]) DB.subscriptions[subscriber] = [];
  const idx = DB.subscriptions[subscriber].indexOf(target);
  idx > -1 ? DB.subscriptions[subscriber].splice(idx, 1) : DB.subscriptions[subscriber].push(target);
  res.json({ subscribed: idx === -1 });
});

app.get('/api/users', (req, res) => {
  res.json(Object.keys(DB.users).map(u => ({ username: u, name: DB.users[u].name })));
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
module.exports = app;
if (require.main === module) app.listen(process.env.PORT || 3000, () => console.log('Zocial OK'));
