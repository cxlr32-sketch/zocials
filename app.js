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
  bank: {}
};

// Пассивный доход банка
setInterval(() => {
  Object.keys(DB.bank).forEach(username => {
    const b = DB.bank[username];
    if (b && b.passiveLevel > 0) {
      b.balance += b.passiveLevel;
    }
    // Начисление процентов по вкладу
    if (b && b.depositAmount > 0 && b.depositTimer && Date.now() - b.depositTimer >= 30000) {
      const cycles = Math.floor((Date.now() - b.depositTimer) / 30000);
      const interest = Math.floor(b.depositAmount * 0.02 * cycles);
      if (interest > 0) {
        b.balance += interest;
        b.depositTimer = Date.now();
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
  
  DB.users[username] = { name, password, bio: '' };
  DB.bank[username] = {
    balance: 100,
    clickLevel: 1,
    passiveLevel: 0,
    depositAmount: 0,
    depositTimer: 0,
    history: []
  };
  
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
  if (idx > -1) {
    post.likedBy.splice(idx, 1);
    post.likes--;
  } else {
    post.likedBy.push(req.body.username);
    post.likes++;
  }
  
  res.json({ likes: post.likes, liked: post.likedBy.includes(req.body.username) });
});

app.post('/api/posts/:id/comment', (req, res) => {
  const post = DB.posts.find(p => p.id === req.params.id);
  if (!post) return res.json({ error: 'пост не найден' });
  
  post.comments.push({ author: req.body.username, text: req.body.text });
  res.json({ success: true });
});

// Банк - получить данные
app.get('/api/bank/:username', (req, res) => {
  if (!DB.bank[req.params.username]) {
    DB.bank[req.params.username] = {
      balance: 100, clickLevel: 1, passiveLevel: 0,
      depositAmount: 0, depositTimer: 0, history: []
    };
  }
  res.json(DB.bank[req.params.username]);
});

// Банк - клик
app.post('/api/bank/click', (req, res) => {
  const b = DB.bank[req.body.username];
  if (!b) return res.json({ error: 'нет счёта' });
  b.balance += b.clickLevel;
  b.history.push({ type: 'click', amount: b.clickLevel, time: new Date().toLocaleTimeString() });
  res.json({ balance: b.balance });
});

// Банк - улучшение кликера
app.post('/api/bank/upgrade', (req, res) => {
  const b = DB.bank[req.body.username];
  const cost = b.clickLevel * 2 * 50;
  if (b.balance < cost) return res.json({ error: 'недостаточно средств' });
  b.balance -= cost;
  b.clickLevel++;
  b.history.push({ type: 'upgrade', amount: -cost, time: new Date().toLocaleTimeString() });
  res.json({ balance: b.balance, clickLevel: b.clickLevel });
});

// Банк - пассивный доход
app.post('/api/bank/passive', (req, res) => {
  const b = DB.bank[req.body.username];
  const cost = (b.passiveLevel + 1) * 100;
  if (b.balance < cost) return res.json({ error: 'недостаточно средств' });
  b.balance -= cost;
  b.passiveLevel++;
  b.history.push({ type: 'passive', amount: -cost, time: new Date().toLocaleTimeString() });
  res.json({ balance: b.balance, passiveLevel: b.passiveLevel });
});

// Банк - вклад
app.post('/api/bank/deposit', (req, res) => {
  const b = DB.bank[req.body.username];
  const amount = parseInt(req.body.amount);
  if (!amount || amount < 100) return res.json({ error: 'мин. сумма вклада 100 🪙' });
  if (b.balance < amount) return res.json({ error: 'недостаточно средств' });
  if (b.depositAmount > 0) return res.json({ error: 'уже есть активный вклад' });
  
  b.balance -= amount;
  b.depositAmount = amount;
  b.depositTimer = Date.now();
  b.history.push({ type: 'deposit', amount: -amount, time: new Date().toLocaleTimeString() });
  res.json({ success: true, balance: b.balance, depositAmount: b.depositAmount });
});

// Банк - снять вклад
app.post('/api/bank/withdraw', (req, res) => {
  const b = DB.bank[req.body.username];
  if (!b.depositAmount) return res.json({ error: 'нет активного вклада' });
  
  const amount = b.depositAmount;
  b.balance += amount;
  b.depositAmount = 0;
  b.depositTimer = 0;
  b.history.push({ type: 'withdraw', amount, time: new Date().toLocaleTimeString() });
  res.json({ success: true, balance: b.balance, depositAmount: 0 });
});

// Банк - перевод
app.post('/api/bank/transfer', (req, res) => {
  const { from, to, amount } = req.body;
  const sender = DB.bank[from];
  const receiver = DB.bank[to];
  
  if (!sender) return res.json({ error: 'отправитель не найден' });
  if (!receiver) return res.json({ error: 'получатель не найден' });
  if (sender.balance < amount) return res.json({ error: 'недостаточно средств' });
  if (amount < 1) return res.json({ error: 'неверная сумма' });
  
  sender.balance -= amount;
  receiver.balance += amount;
  
  sender.history.push({ type: 'transfer_out', amount: -amount, time: new Date().toLocaleTimeString() });
  receiver.history.push({ type: 'transfer_in', amount, time: new Date().toLocaleTimeString() });
  
  // Отправляем сообщение в чат
  if (!DB.chats[to]) DB.chats[to] = {};
  if (!DB.chats[to][from]) DB.chats[to][from] = [];
  if (!DB.chats[from]) DB.chats[from] = {};
  if (!DB.chats[from][to]) DB.chats[from][to] = [];
  
  const msg = { from, text: `💰 перевёл вам ${amount} 🪙`, time: new Date().toLocaleTimeString() };
  DB.chats[to][from].push(msg);
  DB.chats[from][to].push(msg);
  
  res.json({ success: true });
});

// Чаты
app.get('/api/chat/:username', (req, res) => {
  res.json(DB.chats[req.params.username] || {});
});

app.post('/api/chat/send', (req, res) => {
  const { from, to, text } = req.body;
  if (!from || !to || !text) return res.json({ error: 'заполните все поля' });
  
  if (!DB.chats[to]) DB.chats[to] = {};
  if (!DB.chats[from]) DB.chats[from] = {};
  if (!DB.chats[to][from]) DB.chats[to][from] = [];
  if (!DB.chats[from][to]) DB.chats[from][to] = [];
  
  const msg = { from, text, time: new Date().toLocaleTimeString() };
  DB.chats[to][from].push(msg);
  DB.chats[from][to].push(msg);
  
  res.json({ success: true });
});

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log('Zocial на порту ' + PORT));
                                  }
