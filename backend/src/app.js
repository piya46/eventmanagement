const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const sessionRoutes = require('./routes/session');
const requestLogger = require('./middleware/requestLogger');
const auditLog = require('./helpers/auditLog');
const participantFieldRoutes = require('./routes/participantFields');
const participantRoutes = require('./routes/participants');
const registrationPointRoutes = require('./routes/registrationPoints');
const path = require('path');


const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use(requestLogger);

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/participant-fields', participantFieldRoutes);
app.use('/api/participants', participantRoutes);
app.use('/api/registration-points', registrationPointRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/dashboard', require('./routes/dashboard'));



app.use((err, req, res, next) => {
  auditLog({
    req,
    action: 'ERROR',
    detail: '',
    status: 500,
    error: err.stack || String(err)
  });
  res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = app;
