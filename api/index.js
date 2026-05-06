const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Подключение к Supabase
const supabaseUrl = 'https://zrfadvncmqpmwawgnaxb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyZmFkdm5jbXFwbXdhd2duYXhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwODIyMjcsImV4cCI6MjA5MzY1ODIyN30.kOeym7x6HUFRpcX694SxIq48b5AZ0hetzfYZ8d5P2NI';
const supabase = createClient(supabaseUrl, supabaseKey);

// Регистрация
app.post('/api/register', async (req, res) => {
  try {
    const { name, username, password } = req.body;
    if (!name || !username || !password) return res.json({ error: 'заполните все поля' });
    if (username.length < 3) return res.json({ error: 'никнейм мин. 3 символа' });
    if (password.length < 4) return res.json({ error: 'пароль мин. 4 символа' });

    const { data: exists } = await supabase.from('users').select('username').eq('username', username).single();
    if (exists) return res.json({ error: 'никнейм занят' });

    await supabase.from('users').insert({ username, name, password });
    await supabase.from('bank').insert({ username });

    res.json({ success: true, user: { name, username } });
  } catch (e) {
    res.json({ error: 'ошибка сервера' });
  }
});

// Вход
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const { data: user } = await supabase.from('users').select('*').eq('username', username).single();
    if (!user || user.password !== password) return res.json({ error: 'неверные данные' });
    res.json({ success: true, user: { name: user.name, username, avatar: user.avatar, bio: user.bio } });
  } catch (e) {
    res.json({ error: 'ошибка сервера' });
  }
});

// Сессия
app.post('/api/session', async (req, res) => {
  try {
    const { username } = req.body;
    const { data: user } = await supabase.from('users').select('*').eq('username', username).single();
    if (!user) return res.json({ error: 'сессия недействительна' });
    res.json({ success: true, user: { name: user.name, username, avatar: user.avatar, bio: user.bio } });
  } catch (e) {
    res.json({ error: 'ошибка' });
  }
});

// Обновление профиля
app.post('/api/profile/update', async (req, res) => {
  try {
    const { username, name, bio, avatar } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (bio !== undefined) updates.bio = bio;
    if (avatar) updates.avatar = avatar;
    
    const { data: user, error } = await supabase.from('users').update(updates).eq('username', username).select().single();
    if (error) return res.json({ error: 'не найден' });
    res.json({ success: true, user: { name: user.name, username, avatar: user.avatar, bio: user.bio } });
  } catch (e) {
    res.json({ error: 'ошибка' });
  }
});

// Посты
app.get('/api/posts', async (req, res) => {
  try {
    const { data } = await supabase.from('posts').select('*').order('timestamp', { ascending: false }).limit(100);
    res.json(data || []);
  } catch (e) { res.json([]); }
});

app.post('/api/posts', async (req, res) => {
  try {
    const { username, text } = req.body;
    if (!text) return res.json({ error: 'пустой пост' });
    const post = { id: 'p' + Date.now(), username, text, timestamp: Date.now() };
    await supabase.from('posts').insert(post);
    res.json({ success: true, post });
  } catch (e) { res.json({ error: 'ошибка' }); }
});

app.post('/api/posts/:id/like', async (req, res) => {
  try {
    const { username } = req.body;
    const { data: post } = await supabase.from('posts').select('*').eq('id', req.params.id).single();
    if (!post) return res.json({ error: 'не найден' });
    
    let likedBy = post.liked_by || [];
    likedBy.includes(username) ? likedBy = likedBy.filter(u => u !== username) : likedBy.push(username);
    
    await supabase.from('posts').update({ liked_by: likedBy, likes: likedBy.length }).eq('id', req.params.id);
    res.json({ likes: likedBy.length, liked: likedBy.includes(username) });
  } catch (e) { res.json({ error: 'ошибка' }); }
});

app.post('/api/posts/:id/comment', async (req, res) => {
  try {
    const { username, text } = req.body;
    const { data: post } = await supabase.from('posts').select('comments').eq('id', req.params.id).single();
    if (!post) return res.json({ error: 'не найден' });
    
    const comments = post.comments || [];
    comments.push({ author: username, text });
    await supabase.from('posts').update({ comments }).eq('id', req.params.id);
    res.json({ success: true });
  } catch (e) { res.json({ error: 'ошибка' }); }
});

app.delete('/api/posts/:id', async (req, res) => {
  try {
    await supabase.from('posts').delete().eq('id', req.params.id);
    res.json({ success: true });
  } catch (e) { res.json({ error: 'ошибка' }); }
});

// Банк
app.get('/api/bank/:username', async (req, res) => {
  try {
    const { data } = await supabase.from('bank').select('*').eq('username', req.params.username).single();
    if (!data) {
      await supabase.from('bank').insert({ username: req.params.username });
      return res.json({ balance: 100, click_level: 1, passive_level: 0 });
    }
    res.json(data);
  } catch (e) { res.json({ error: 'ошибка' }); }
});

app.post('/api/bank/click', async (req, res) => {
  try {
    const { username } = req.body;
    const { data: bank } = await supabase.from('bank').select('*').eq('username', username).single();
    if (!bank) return res.json({ error: 'нет счёта' });
    const newBalance = bank.balance + bank.click_level;
    await supabase.from('bank').update({ balance: newBalance }).eq('username', username);
    res.json({ balance: newBalance });
  } catch (e) { res.json({ error: 'ошибка' }); }
});

app.post('/api/bank/upgrade', async (req, res) => {
  try {
    const { username } = req.body;
    const { data: bank } = await supabase.from('bank').select('*').eq('username', username).single();
    const cost = bank.click_level * 2 * 50;
    if (bank.balance < cost) return res.json({ error: 'недостаточно средств' });
    const newBalance = bank.balance - cost;
    const newLevel = bank.click_level + 1;
    await supabase.from('bank').update({ balance: newBalance, click_level: newLevel }).eq('username', username);
    res.json({ balance: newBalance, clickLevel: newLevel });
  } catch (e) { res.json({ error: 'ошибка' }); }
});

app.post('/api/bank/passive', async (req, res) => {
  try {
    const { username } = req.body;
    const { data: bank } = await supabase.from('bank').select('*').eq('username', username).single();
    const cost = (bank.passive_level + 1) * 100;
    if (bank.balance < cost) return res.json({ error: 'недостаточно средств' });
    const newBalance = bank.balance - cost;
    const newLevel = bank.passive_level + 1;
    await supabase.from('bank').update({ balance: newBalance, passive_level: newLevel }).eq('username', username);
    res.json({ balance: newBalance, passiveLevel: newLevel });
  } catch (e) { res.json({ error: 'ошибка' }); }
});

app.post('/api/bank/transfer', async (req, res) => {
  try {
    const { from, to, amount } = req.body;
    const { data: s } = await supabase.from('bank').select('*').eq('username', from).single();
    const { data: r } = await supabase.from('bank').select('*').eq('username', to).single();
    if (!s || !r) return res.json({ error: 'пользователь не найден' });
    if (s.balance < amount) return res.json({ error: 'недостаточно средств' });
    
    await supabase.from('bank').update({ balance: s.balance - amount }).eq('username', from);
    await supabase.from('bank').update({ balance: r.balance + amount }).eq('username', to);
    
    await supabase.from('chats').insert({ from_user: from, to_user: to, text: `💰 перевёл ${amount} 🪙`, time: new Date().toLocaleTimeString() });
    
    res.json({ success: true });
  } catch (e) { res.json({ error: 'ошибка' }); }
});

// Чаты
app.get('/api/chat/:username', async (req, res) => {
  try {
    const { data: sent } = await supabase.from('chats').select('*').eq('from_user', req.params.username);
    const { data: received } = await supabase.from('chats').select('*').eq('to_user', req.params.username);
    const all = [...(sent || []), ...(received || [])];
    
    const chats = {};
    all.forEach(msg => {
      const other = msg.from_user === req.params.username ? msg.to_user : msg.from_user;
      if (!chats[other]) chats[other] = [];
      chats[other].push({ from: msg.from_user, text: msg.text, time: msg.time });
    });
    
    res.json(chats);
  } catch (e) { res.json({}); }
});

app.post('/api/chat/send', async (req, res) => {
  try {
    const { from, to, text } = req.body;
    await supabase.from('chats').insert({ from_user: from, to_user: to, text, time: new Date().toLocaleTimeString() });
    res.json({ success: true });
  } catch (e) { res.json({ error: 'ошибка' }); }
});

// Подписки
app.get('/api/subs/:username', async (req, res) => {
  try {
    const { data } = await supabase.from('subscriptions').select('target').eq('subscriber', req.params.username);
    res.json((data || []).map(d => d.target));
  } catch (e) { res.json([]); }
});

app.post('/api/subs/toggle', async (req, res) => {
  try {
    const { subscriber, target } = req.body;
    const { data: existing } = await supabase.from('subscriptions').select('*').eq('subscriber', subscriber).eq('target', target).single();
    
    if (existing) {
      await supabase.from('subscriptions').delete().eq('subscriber', subscriber).eq('target', target);
      res.json({ subscribed: false });
    } else {
      await supabase.from('subscriptions').insert({ subscriber, target });
      res.json({ subscribed: true });
    }
  } catch (e) { res.json({ error: 'ошибка' }); }
});

// Пользователи
app.get('/api/users', async (req, res) => {
  try {
    const { data } = await supabase.from('users').select('username, name, avatar');
    res.json(data || []);
  } catch (e) { res.json([]); }
});

app.get('/api/users/search', async (req, res) => {
  try {
    const q = (req.query.q || '').toLowerCase().trim();
    if (!q) return res.json([]);
    const { data } = await supabase.from('users').select('username, name, avatar').or(`username.ilike.%${q}%,name.ilike.%${q}%`).limit(10);
    res.json(data || []);
  } catch (e) { res.json([]); }
});

app.get('/api/users/:username', async (req, res) => {
  try {
    const { data } = await supabase.from('users').select('*').eq('username', req.params.username).single();
    if (!data) return res.json({ error: 'не найден' });
    res.json({ username: data.username, name: data.name, avatar: data.avatar, bio: data.bio });
  } catch (e) { res.json({ error: 'ошибка' }); }
});

// Верификация
app.post('/api/verify/toggle', async (req, res) => {
  try {
    const { by, target } = req.body;
    if (by !== 'snzhk') return res.json({ error: 'нет прав' });
    const { data } = await supabase.from('verified').select('*').eq('username', target).single();
    if (data) {
      await supabase.from('verified').delete().eq('username', target);
      res.json({ verified: false });
    } else {
      await supabase.from('verified').insert({ username: target });
      res.json({ verified: true });
    }
  } catch (e) { res.json({ error: 'ошибка' }); }
});

app.get('/api/verified', async (req, res) => {
  try {
    const { data } = await supabase.from('verified').select('username');
    res.json((data || []).map(d => d.username));
  } catch (e) { res.json([]); }
});

// Gray AI
app.post('/api/grayai', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.json({ response: 'задайте вопрос' });
    
    const responses = [
      `Интересный вопрос! "${prompt}" — это тема для размышления.`,
      `По поводу "${prompt}": мне кажется, это зависит от многих факторов.`,
      `Отличный вопрос! Я бы посоветовал узнать больше о "${prompt}".`
    ];
    res.json({ response: responses[Math.floor(Math.random() * responses.length)] });
  } catch (e) {
    res.json({ response: 'ошибка' });
  }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

module.exports = app;
