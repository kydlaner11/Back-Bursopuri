const express = require('express');

const app = express();

app.use(express.json());
app.use('/', require('./src/routes/authRoutes'));
app.use(require('./src/middleware/errorMiddleware').all);

module.exports = app;