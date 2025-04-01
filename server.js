const express = require('express');
const prisma = require('./database/connection');

const app = express();

app.use(express.json());
app.use('/', require('./src/routes/authRoutes'));
app.use(require('./src/middleware/errorMiddleware').all);

app.get('/api', (req, res) => {
  res.send({ message: 'Welcome to the API' });
});

app.get('/users', (req, res) => {
  prisma.user.findMany()
    .then(users => res.json(users))
    .catch(err => res.status(500).json({ error: err.message }));
});

module.exports = app;