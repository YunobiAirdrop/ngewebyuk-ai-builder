require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use('/admin', require('./routes/admin'));
app.use('/webhook', require('./routes/webhook'));
app.use('/', require('./routes/preview'));

app.get('/ping', (req, res) => res.send('PONG'));

app.use((req, res) => {
  res.status(404).render('error', { message: 'Halaman tidak ditemukan.' });
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`🚀 Server Running on Port ${process.env.PORT || 3000}`);
});