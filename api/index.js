const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const supabase = createClient(
  'https://zrfadvncmqpmwawgnaxb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyZmFkdm5jbXFwbXdhd2duYXhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwODIyMjcsImV4cCI6MjA5MzY1ODIyN30.kOeym7x6HUFRpcX694SxIq48b5AZ0hetzfYZ8d5P2NI'
);

// Утилита: получить или создать банк
async function getBank(username) {
  const { data } = await supabase.from('bank').select('*').eq('username', username).maybeSingle();
  if (data) return data;
  const acc = { username, balance: 100, click_level: 1, passive_level: 0 };
  await supabase.from('bank').insert(acc);
  return acc;
}

// ========== АВТОРИЗАЦИЯ ==========
app.post('/api/register', async (req, res) => {
  const { name, username, password } = req.body;
  if (!name || !username || !password) return res.json({ error: 'заполните все поля' });
  if (username.length < 3) return res.json({ error: 'никнейм мин. 3 символа' });
  if (password.length < 4) return res.json({ error: 'пароль мин. 4 символа' });
  const { data: ex } = await supabase.from('users').select('username').eq('username', username).maybeSingle();
  if (ex) return res.json({ error: 'никнейм занят' });
  await supabase.from('users').insert({ username, name, password });
  await supabase.from('bank').insert({ username, balance: 100, click_level: 1, passive_level: 0 });
  res.json({ success: true, user: { name, username } });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const { data: u } = await supabase.from('users').select('*').eq('username', username).maybeSingle();
  if (!u || u.password !== password) return res.json({ error: 'неверные данные' });
  res.json({ success: true, user: { name: u.name, username, avatar: u.avatar, bio: u.bio } });
});

app.post('/api/session', async (req, res) => {
  const { data: u } = await supabase.from('users').select('*').eq('username', req.body.username).maybeSingle();
  if (!u) return res.json({ error: 'сессия недействительна' });
  res.json({ success: true, user: { name: u.name, username: req.body.username, avatar: u.avatar, bio: u.bio } });
});

// ========== ПРОФИЛЬ ==========
app.post('/api/profile/update', async (req, res) => {
  const { username, name, bio, avatar } = req.body;
  const upd = {}; if (name) upd.name = name; if (bio !== undefined) upd.bio = bio; if (avatar) upd.avatar = avatar;
  const { data: u } = await supabase.from('users').update(upd).eq('username', username).select().maybeSingle();
  res.json({ success: true, user: { name: u.name, username, avatar: u.avatar, bio: u.bio } });
});

// ========== ПОСТЫ ==========
app.get('/api/posts', async (req, res) => {
  const { data } = await supabase.from('posts').select('*').order('timestamp', { ascending: false }).limit(100);
  res.json(data || []);
});

app.post('/api/posts', async (req, res) => {
  const { username, text, media, mediaType } = req.body;
  if (!text && !media) return res.json({ error: 'пустой пост' });
  const post = { id: 'p' + Date.now(), username, text: text || '', media: media || null, media_type: mediaType || null, time: 'только что', timestamp: Date.now(), likes: 0, liked_by: [], comments: [] };
  const { error } = await supabase.from('posts').insert(post);
  if (error) return res.json({ error: 'ошибка базы' });
  res.json({ success: true, post });
});

app.post('/api/posts/:id/like', async (req, res) => {
  const { data: p } = await supabase.from('posts').select('liked_by').eq('id', req.params.id).maybeSingle();
  if (!p) return res.json({ error: 'не найден' });
  let arr = p.liked_by || [];
  arr.includes(req.body.username) ? arr = arr.filter(u => u !== req.body.username) : arr.push(req.body.username);
  await supabase.from('posts').update({ liked_by: arr, likes: arr.length }).eq('id', req.params.id);
  res.json({ likes: arr.length, liked: arr.includes(req.body.username) });
});

app.post('/api/posts/:id/comment', async (req, res) => {
  const { data: p } = await supabase.from('posts').select('comments').eq('id', req.params.id).maybeSingle();
  if (!p) return res.json({ error: 'не найден' });
  const comments = (p.comments || []);
  comments.push({ author: req.body.username, text: req.body.text });
  await supabase.from('posts').update({ comments }).eq('id', req.params.id);
  res.json({ success: true });
});

app.delete('/api/posts/:id', async (req, res) => {
  await supabase.from('posts').delete().eq('id', req.params.id);
  res.json({ success: true });
});

// ========== БАНК ==========
app.get('/api/bank/:username', async (req, res) => { res.json(await getBank(req.params.username)); });

app.post('/api/bank/click', async (req, res) => {
  const b = await getBank(req.body.username);
  const nb = b.balance + b.click_level;
  await supabase.from('bank').update({ balance: nb }).eq('username', req.body.username);
  res.json({ balance: nb });
});

app.post('/api/bank/upgrade', async (req, res) => {
  const b = await getBank(req.body.username);
  const cost = b.click_level * 2 * 50;
  if (b.balance < cost) return res.json({ error: 'недостаточно средств' });
  await supabase.from('bank').update({ balance: b.balance - cost, click_level: b.click_level + 1 }).eq('username', req.body.username);
  res.json({ balance: b.balance - cost, clickLevel: b.click_level + 1 });
});

app.post('/api/bank/passive', async (req, res) => {
  const b = await getBank(req.body.username);
  const cost = (b.passive_level + 1) * 100;
  if (b.balance < cost) return res.json({ error: 'недостаточно средств' });
  await supabase.from('bank').update({ balance: b.balance - cost, passive_level: b.passive_level + 1 }).eq('username', req.body.username);
  res.json({ balance: b.balance - cost, passiveLevel: b.passive_level + 1 });
});

app.post('/api/bank/transfer', async (req, res) => {
  const { from, to, amount } = req.body;
  const amt = parseInt(amount);
  if (!amt || amt < 1) return res.json({ error: 'неверная сумма' });
  const s = await getBank(from), r = await getBank(to);
  if (s.balance < amt) return res.json({ error: 'недостаточно средств' });
  await supabase.from('bank').update({ balance: s.balance - amt }).eq('username', from);
  await supabase.from('bank').update({ balance: r.balance + amt }).eq('username', to);
  await supabase.from('chats').insert({ from_user: from, to_user: to, text: `💰 перевёл ${amt} 🪙`, time: new Date().toLocaleTimeString() });
  res.json({ success: true });
});

// ========== ЧАТЫ ==========
app.get('/api/chat/:username', async (req, res) => {
  const { data } = await supabase.from('chats').select('*').or(`from_user.eq.${req.params.username},to_user.eq.${req.params.username}`);
  const chats = {};
  (data || []).forEach(m => {
    const o = m.from_user === req.params.username ? m.to_user : m.from_user;
    if (!chats[o]) chats[o] = [];
    chats[o].push({ from: m.from_user, text: m.text, time: m.time });
  });
  res.json(chats);
});

app.post('/api/chat/send', async (req, res) => {
  await supabase.from('chats').insert({ from_user: req.body.from, to_user: req.body.to, text: req.body.text, time: new Date().toLocaleTimeString() });
  res.json({ success: true });
});

// ========== ПОДПИСКИ ==========
app.get('/api/subs/:username', async (req, res) => {
  const { data } = await supabase.from('subscriptions').select('target').eq('subscriber', req.params.username);
  res.json((data || []).map(d => d.target));
});

app.post('/api/subs/toggle', async (req, res) => {
  const { subscriber, target } = req.body;
  const { data: ex } = await supabase.from('subscriptions').select('*').eq('subscriber', subscriber).eq('target', target).maybeSingle();
  if (ex) { await supabase.from('subscriptions').delete().eq('subscriber', subscriber).eq('target', target); res.json({ subscribed: false }); }
  else { await supabase.from('subscriptions').insert({ subscriber, target }); res.json({ subscribed: true }); }
});

// ========== ПОЛЬЗОВАТЕЛИ ==========
app.get('/api/users', async (req, res) => {
  const { data } = await supabase.from('users').select('username, name, avatar');
  res.json(data || []);
});

app.get('/api/users/search', async (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  if (!q) return res.json([]);
  const { data } = await supabase.from('users').select('username, name, avatar').or(`username.ilike.%${q}%,name.ilike.%${q}%`).limit(10);
  res.json(data || []);
});

app.get('/api/users/:username', async (req, res) => {
  const { data } = await supabase.from('users').select('*').eq('username', req.params.username).maybeSingle();
  if (!data) return res.json({ error: 'не найден' });
  res.json(data);
});

// ========== GRAY AI ==========
app.post('/api/grayai', async (req, res) => {
  const r = ['Интересный вопрос!', 'Я думаю, это зависит от ситуации.', 'Хорошая тема для размышления.', 'Попробуйте посмотреть с другой стороны.'];
  res.json({ response: r[Math.floor(Math.random() * r.length)] });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));
module.exports = app;
