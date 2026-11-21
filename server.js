const express = require('express');
const cors = require('cors');
const prisma = require('./database/connection');

const app = express();

app.use(cors())
app.use(express.json());
app.use('/', require('./src/routes/authRoutes'));
app.use('/', require('./src/routes/menuRoutes'));
app.use('/bursopuri', require('./src/routes/othersRoutes'));
app.use('/api/v1/finance', require('./src/routes/financeRoutes'));
const errorMiddleware = require('./src/middleware/errorMiddleware');

app.get('/api', (req, res) => {
  res.send({ message: 'Welcome to the API' });
});

// 404 dan error handler selalu paling akhir
app.use((req, res, next) => {
  const error = new Error('Endpoint tidak ditemukan');
  error.status = 404;
  next(error);
});
app.use(errorMiddleware);

module.exports = app;