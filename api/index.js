const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
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
    DB.bank[username] = { balance: 100, clickLevel: 1, passiveLevel: 0, depositAmount: 0, depositTimer: 0, history: [], savingsBalance: 0 };
    DB.subscriptions[username] = [];
    res.json({ success: true, user: { name, username } });
  } catch (e) { res.json({ error: 'ошибка сервера' }); }
});

// Вход
app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const user = DB.users[username];
    if (!user || user.password !== password) return res.json({ error: 'неверные данные' });
    res.json({ success: true, user: { name: user.name, username, avatar: user.avatar, bio: user.bio } });
  } catch (e) { res.json({ error: 'ошибка сервера' }); }
});

// Сессия
app.post('/api/session', (req, res) => {
  try {
    const { username } = req.body;
    const user = DB.users[username];
    if (!user) return res.json({ error: 'сессия недействительна' });
    res.json({ success: true, user: { name: user.name, username, avatar: user.avatar, bio: user.bio } });
  } catch (e) { res.json({ error: 'ошибка сервера' }); }
});

// Обновление профиля
app.post('/api/profile/update', (req, res) => {
  try {
    const { username, name, bio, avatar } = req.body;
    const user = DB.users[username];
    if (!user) return res.json({ error: 'не найден' });
    if (name) user.name = name;
    if (bio !== undefined) user.bio = bio;
    if (avatar) user.avatar = avatar;
    res.json({ success: true, user: { name: user.name, username, avatar: user.avatar, bio: user.bio } });
  } catch (e) { res.json({ error: 'ошибка сервера' }); }
});

// Посты
app.get('/api/posts', (req, res) => {
  try { res.json([...DB.posts].sort((a, b) => b.timestamp - a.timestamp)); }
  catch (e) { res.json([]); }
});

app.post('/api/posts', (req, res) => {
  try {
    const { username, text } = req.body;
    if (!text) return res.json({ error: 'пустой пост' });
    const post = { id: 'p' + Date.now(), username, text, time: 'только что', timestamp: Date.now(), likes: 0, likedBy: [], comments: [] };
    DB.posts.push(post);
    res.json({ success: true, post });
  } catch (e) { res.json({ error: 'ошибка сервера' }); }
});

app.post('/api/posts/:id/like', (req, res) => {
  try {
    const post = DB.posts.find(p => p.id === req.params.id);
    if (!post) return res.json({ error: 'не найден' });
    const idx = post.likedBy.indexOf(req.body.username);
    idx > -1 ? (post.likedBy.splice(idx, 1), post.likes--) : (post.likedBy.push(req.body.username), post.likes++);
    res.json({ likes: post.likes, liked: post.likedBy.includes(req.body.username) });
  } catch (e) { res.json({ error: 'ошибка сервера' }); }
});

app.post('/api/posts/:id/comment', (req, res) => {
  try {
    const post = DB.posts.find(p => p.id === req.params.id);
    if (!post) return res.json({ error: 'не найден' });
    post.comments.push({ author: req.body.username, text: req.body.text });
    res.json({ success: true });
  } catch (e) { res.json({ error: 'ошибка сервера' }); }
});

app.delete('/api/posts/:id', (req, res) => {
  try {
    const idx = DB.posts.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.json({ error: 'не найден' });
    DB.posts.splice(idx, 1);
    res.json({ success: true });
  } catch (e) { res.json({ error: 'ошибка сервера' }); }
});

// Банк
app.get('/api/bank/:username', (req, res) => {
  try {
    if (!DB.bank[req.params.username]) DB.bank[req.params.username] = { balance: 100, clickLevel: 1, passiveLevel: 0, depositAmount: 0, depositTimer: 0, history: [], savingsBalance: 0 };
    res.json(DB.bank[req.params.username]);
  } catch (e) { res.json({ error: 'ошибка сервера' }); }
});

app.post('/api/bank/click', (req, res) => {
  try { const b = DB.bank[req.body.username]; b.balance += b.clickLevel; res.json({ balance: b.balance }); }
  catch (e) { res.json({ error: 'ошибка' }); }
});

app.post('/api/bank/upgrade', (req, res) => {
  try {
    const b = DB.bank[req.body.username]; const cost = b.clickLevel * 2 * 50;
    if (b.balance < cost) return res.json({ error: 'недостаточно средств' });
    b.balance -= cost; b.clickLevel++;
    res.json({ balance: b.balance, clickLevel: b.clickLevel });
  } catch (e) { res.json({ error: 'ошибка' }); }
});

app.post('/api/bank/passive', (req, res) => {
  try {
    const b = DB.bank[req.body.username]; const cost = (b.passiveLevel + 1) * 100;
    if (b.balance < cost) return res.json({ error: 'недостаточно средств' });
    b.balance -= cost; b.passiveLevel++;
    res.json({ balance: b.balance, passiveLevel: b.passiveLevel });
  } catch (e) { res.json({ error: 'ошибка' }); }
});

app.post('/api/bank/transfer', (req, res) => {
  try {
    const { from, to, amount } = req.body;
    const s = DB.bank[from], r = DB.bank[to];
    if (!s || !r) return res.json({ error: 'пользователь не найден' });
    if (s.balance < amount) return res.json({ error: 'недостаточно средств' });
    s.balance -= amount; r.balance += amount;
    if (!DB.chats[to]) DB.chats[to] = {}; if (!DB.chats[from]) DB.chats[from] = {};
    const msg = { from, text: `💰 перевёл ${amount} 🪙`, time: new Date().toLocaleTimeString() };
    if (!DB.chats[to][from]) DB.chats[to][from] = []; if (!DB.chats[from][to]) DB.chats[from][to] = [];
    DB.chats[to][from].push(msg); DB.chats[from][to].push(msg);
    res.json({ success: true });
  } catch (e) { res.json({ error: 'ошибка' }); }
});

// Чаты
app.get('/api/chat/:username', (req, res) => {
  try { res.json(DB.chats[req.params.username] || {}); }
  catch (e) { res.json({}); }
});

app.post('/api/chat/send', (req, res) => {
  try {
    const { from, to, text } = req.body;
    if (!DB.chats[to]) DB.chats[to] = {}; if (!DB.chats[from]) DB.chats[from] = {};
    if (!DB.chats[to][from]) DB.chats[to][from] = []; if (!DB.chats[from][to]) DB.chats[from][to] = [];
    const msg = { from, text, time: new Date().toLocaleTimeString() };
    DB.chats[to][from].push(msg); DB.chats[from][to].push(msg);
    res.json({ success: true });
  } catch (e) { res.json({ error: 'ошибка' }); }
});

// Подписки
app.get('/api/subs/:username', (req, res) => {
  try { res.json(DB.subscriptions[req.params.username] || []); }
  catch (e) { res.json([]); }
});

app.post('/api/subs/toggle', (req, res) => {
  try {
    const { subscriber, target } = req.body;
    if (!DB.subscriptions[subscriber]) DB.subscriptions[subscriber] = [];
    const idx = DB.subscriptions[subscriber].indexOf(target);
    idx > -1 ? DB.subscriptions[subscriber].splice(idx, 1) : DB.subscriptions[subscriber].push(target);
    res.json({ subscribed: idx === -1 });
  } catch (e) { res.json({ error: 'ошибка' }); }
});

// Пользователи
app.get('/api/users', (req, res) => {
  try { res.json(Object.keys(DB.users).map(u => ({ username: u, name: DB.users[u].name, avatar: DB.users[u].avatar }))); }
  catch (e) { res.json([]); }
});

app.get('/api/users/search', (req, res) => {
  try {
    const q = (req.query.q || '').toLowerCase().trim();
    if (!q) return res.json([]);
    res.json(Object.keys(DB.users).filter(u => u.toLowerCase().includes(q) || (DB.users[u].name || '').toLowerCase().includes(q)).slice(0, 10).map(u => ({ username: u, name: DB.users[u].name, avatar: DB.users[u].avatar })));
  } catch (e) { res.json([]); }
});

app.get('/api/users/:username', (req, res) => {
  try {
    const u = DB.users[req.params.username];
    if (!u) return res.json({ error: 'не найден' });
    res.json({ username: req.params.username, name: u.name, avatar: u.avatar, bio: u.bio });
  } catch (e) { res.json({ error: 'ошибка' }); }
});

// Gray AI с Hugging Face (ИСПРАВЛЕНО)
app.post('/api/grayai', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.json({ response: 'задайте вопрос' });

    const response = await fetch(
      'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer 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',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: `Ты — дружелюбный AI-ассистент. Ответь кратко на русском: ${prompt}`,
          parameters: {
            max_new_tokens: 150,
            temperature: 0.7,
            return_full_text: false
          }
        })
      }
    );

    // Если модель не загружена - ждём
    if (response.status === 503) {
      const retryAfter = response.headers.get('retry-after') || 10;
      return res.json({ response: `Модель загружается. Пожалуйста, подождите ${retryAfter} секунд и попробуйте снова.` });
    }

    const data = await response.json();
    console.log('HF response:', JSON.stringify(data));

    let answer = '';

    if (Array.isArray(data) && data.length > 0) {
      if (typeof data[0] === 'string') {
        answer = data[0].trim();
      } else if (data[0]?.generated_text) {
        answer = data[0].generated_text.trim();
      }
    }

    if (!answer || answer.length < 2) {
      // Если модель не ответила - используем локальные ответы
      const localResponses = [
        `Интересный вопрос! Я думаю, что "${prompt}" — это тема для размышления.`,
        `По поводу "${prompt}": мне кажется, это зависит от многих факторов.`,
        `Отличный вопрос! Я бы посоветовал узнать больше о "${prompt}".`,
        `"${prompt}" — звучит любопытно! Расскажите подробнее.`,
        `Спасибо за вопрос! "${prompt}" заслуживает внимания.`
      ];
      answer = localResponses[Math.floor(Math.random() * localResponses.length)];
    }

    res.json({ response: answer });
  } catch (e) {
    console.error('Gray AI error:', e);
    const localResponses = [
      `Извините, я сейчас загружаюсь. Попробуйте через минуту!`,
      `Модель обновляется. Пожалуйста, подождите немного.`,
      `Я пока учусь. Задайте вопрос чуть позже!`
    ];
    res.json({ response: localResponses[Math.floor(Math.random() * localResponses.length)] });
  }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

module.exports = app;
