const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const DB = { users: {}, posts: [], chats: {}, bank: {} };

// Регистрация
app.post('/api/register', (req, res) => {
  const { name, username, password } = req.body;
  if (!name || !username || !password) return res.json({ error: 'заполните все поля' });
  if (DB.users[username]) return res.json({ error: 'никнейм занят' });
  DB.users[username] = { name, password, bio: '' };
  DB.bank[username] = { balance: 100, clickLevel: 1, passiveLevel: 0 };
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
  res.json([...DB.posts].sort((a, b) => b.timestamp - a.timestamp));
});

app.post('/api/posts', (req, res) => {
  const { username, text } = req.body;
  if (!text) return res.json({ error: 'пустой пост' });
  DB.posts.push({
    id: 'p' + Date.now(), username, text,
    time: 'только что', timestamp: Date.now(),
    likes: 0, likedBy: [], comments: []
  });
  res.json({ success: true });
});

// Лайк
app.post('/api/posts/:id/like', (req, res) => {
  const post = DB.posts.find(p => p.id === req.params.id);
  if (!post) return res.json({ error: 'пост не найден' });
  const idx = post.likedBy.indexOf(req.body.username);
  idx > -1 ? post.likedBy.splice(idx, 1) : post.likedBy.push(req.body.username);
  post.likes = post.likedBy.length;
  res.json({ likes: post.likes, liked: idx === -1 });
});

// Комментарий
app.post('/api/posts/:id/comment', (req, res) => {
  const post = DB.posts.find(p => p.id === req.params.id);
  if (!post) return res.json({ error: 'пост не найден' });
  post.comments.push({ author: req.body.username, text: req.body.text });
  res.json({ success: true });
});

// Банк
app.get('/api/bank/:username', (req, res) => {
  if (!DB.bank[req.params.username]) DB.bank[req.params.username] = { balance: 100, clickLevel: 1 };
  res.json(DB.bank[req.params.username]);
});

app.post('/api/bank/click', (req, res) => {
  const b = DB.bank[req.body.username];
  b.balance += b.clickLevel;
  res.json({ balance: b.balance });
});

app.post('/api/bank/upgrade', (req, res) => {
  const b = DB.bank[req.body.username];
  const cost = b.clickLevel * 100;
  if (b.balance < cost) return res.json({ error: 'недостаточно средств' });
  b.balance -= cost;
  b.clickLevel++;
  res.json({ balance: b.balance });
});

// Чаты
app.get('/api/chat/:username', (req, res) => {
  res.json(DB.chats[req.params.username] || {});
});

app.post('/api/chat/send', (req, res) => {
  const { from, to, text } = req.body;
  if (!DB.chats[to]) DB.chats[to] = {};
  if (!DB.chats[from]) DB.chats[from] = {};
  const msg = { from, text, time: new Date().toLocaleTimeString() };
  if (!DB.chats[to][from]) DB.chats[to][from] = [];
  if (!DB.chats[from][to]) DB.chats[from][to] = [];
  DB.chats[to][from].push(msg);
  DB.chats[from][to].push(msg);
  res.json({ success: true });
});

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

module.exports = app;
if (require.main === module) app.listen(process.env.PORT || 3000, () => console.log('OK'));
