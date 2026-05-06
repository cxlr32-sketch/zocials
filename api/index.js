const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Отдаём статику из папки public
app.use(express.static(path.join(__dirname, '..', 'public')));

// База данных
const DB = {
  users: {},
  posts: [],
  chats: {},
  bank: {},
  subscriptions: {},
  verified: ['snzhk']
};

// Регистрация
app.post('/api/register', (req, res) => {
  try {
    const { name, username, password } = req.body;
    if (!name || !username || !password) return res.json({ error: 'заполните все поля' });
    if (username.length < 3) return res.json({ error: 'никнейм мин. 3 символа' });
    if (password.length < 4) return res.json({ error: 'пароль мин. 4 символа' });
    if (DB.users[username]) return res.json({ error: 'никнейм занят' });

    DB.users[username] = { name, username, password, avatar: null, bio: '' };
    DB.bank[username] = { balance: 100, clickLevel: 1, passiveLevel: 0 };
    DB.subscriptions[username] = [];

    res.json({ success: true, user: { name, username } });
  } catch (e) {
    res.json({ error: 'ошибка сервера' });
  }
});

// Вход
app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const user = DB.users[username];
    if (!user || user.password !== password) return res.json({ error: 'неверные данные' });
    res.json({ success: true, user: { name: user.name, username, avatar: user.avatar, bio: user.bio } });
  } catch (e) {
    res.json({ error: 'ошибка сервера' });
  }
});

// Проверка сессии
app.post('/api/session', (req, res) => {
  try {
    const { username } = req.body;
    const user = DB.users[username];
    if (!user) return res.json({ error: 'сессия недействительна' });
    res.json({ success: true, user: { name: user.name, username, avatar: user.avatar, bio: user.bio } });
  } catch (e) {
    res.json({ error: 'ошибка сервера' });
  }
});

// Посты
app.get('/api/posts', (req, res) => {
  try {
    const sorted = [...DB.posts].sort((a, b) => b.timestamp - a.timestamp);
    res.json(sorted);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/posts', (req, res) => {
  try {
    const { username, text } = req.body;
    if (!text) return res.json({ error: 'пустой пост' });
    const post = { id: 'p' + Date.now(), username, text, time: 'только что', timestamp: Date.now(), likes: 0, likedBy: [], comments: [] };
    DB.posts.push(post);
    res.json({ success: true, post });
  } catch (e) {
    res.json({ error: 'ошибка сервера' });
  }
});

app.post('/api/posts/:id/like', (req, res) => {
  try {
    const post = DB.posts.find(p => p.id === req.params.id);
    if (!post) return res.json({ error: 'не найден' });
    const idx = post.likedBy.indexOf(req.body.username);
    if (idx > -1) { post.likedBy.splice(idx, 1); post.likes--; }
    else { post.likedBy.push(req.body.username); post.likes++; }
    res.json({ likes: post.likes, liked: post.likedBy.includes(req.body.username) });
  } catch (e) {
    res.json({ error: 'ошибка сервера' });
  }
});

// Банк
app.get('/api/bank/:username', (req, res) => {
  try {
    if (!DB.bank[req.params.username]) DB.bank[req.params.username] = { balance: 100, clickLevel: 1, passiveLevel: 0 };
    res.json(DB.bank[req.params.username]);
  } catch (e) {
    res.json({ balance: 100, clickLevel: 1, passiveLevel: 0 });
  }
});

app.post('/api/bank/click', (req, res) => {
  try {
    const b = DB.bank[req.body.username];
    if (!b) return res.json({ error: 'нет счёта' });
    b.balance += b.clickLevel;
    res.json({ balance: b.balance });
  } catch (e) {
    res.json({ error: 'ошибка сервера' });
  }
});

app.post('/api/bank/upgrade', (req, res) => {
  try {
    const b = DB.bank[req.body.username];
    const cost = b.clickLevel * 2 * 50;
    if (b.balance < cost) return res.json({ error: 'недостаточно средств' });
    b.balance -= cost; b.clickLevel++;
    res.json({ balance: b.balance, clickLevel: b.clickLevel });
  } catch (e) {
    res.json({ error: 'ошибка сервера' });
  }
});

// Чаты
app.get('/api/chat/:username', (req, res) => {
  try {
    res.json(DB.chats[req.params.username] || {});
  } catch (e) {
    res.json({});
  }
});

app.post('/api/chat/send', (req, res) => {
  try {
    const { from, to, text } = req.body;
    if (!DB.chats[to]) DB.chats[to] = {};
    if (!DB.chats[from]) DB.chats[from] = {};
    if (!DB.chats[to][from]) DB.chats[to][from] = [];
    if (!DB.chats[from][to]) DB.chats[from][to] = [];
    const msg = { from, text, time: new Date().toLocaleTimeString() };
    DB.chats[to][from].push(msg);
    DB.chats[from][to].push(msg);
    res.json({ success: true });
  } catch (e) {
    res.json({ error: 'ошибка сервера' });
  }
});

// Пользователи
app.get('/api/users', (req, res) => {
  try {
    res.json(Object.keys(DB.users).map(u => ({ username: u, name: DB.users[u].name, avatar: DB.users[u].avatar })));
  } catch (e) {
    res.json([]);
  }
});

app.get('/api/users/search', (req, res) => {
  try {
    const q = (req.query.q || '').toLowerCase().trim();
    if (!q) return res.json([]);
    const results = Object.keys(DB.users).filter(u => u.toLowerCase().includes(q) || (DB.users[u].name || '').toLowerCase().includes(q)).slice(0, 10).map(u => ({ username: u, name: DB.users[u].name, avatar: DB.users[u].avatar }));
    res.json(results);
  } catch (e) {
    res.json([]);
  }
});

app.get('/api/users/:username', (req, res) => {
  try {
    const u = DB.users[req.params.username];
    if (!u) return res.json({ error: 'не найден' });
    res.json({ username: req.params.username, name: u.name, avatar: u.avatar, bio: u.bio });
  } catch (e) {
    res.json({ error: 'ошибка сервера' });
  }
});

// Головна сторінка
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

module.exports = app;
