const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/authRoutes');
const patientRoutes = require('./routes/patientRoutes');
const communityRoutes = require('./routes/communityRoutes');
const scanRoutes = require('./routes/scanRoutes');
const catalogRoutes = require('./routes/catalogRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const doctorChatRoutes = require('./routes/doctorChatRoutes');
const doctorAuthRoutes = require('./routes/doctorAuthRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const chatRoutes = require('./routes/chatRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
const allowedOrigins = process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean);
const isDev = process.env.NODE_ENV !== 'production';
const localOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

app.use(cors({
  origin(origin, callback) {
    // Allow non-browser tools (no Origin header).
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins && allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // In development, allow localhost on any port to avoid Expo web port churn issues.
    if (isDev && localOriginPattern.test(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'lesio-backend' });
});

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/scans', scanRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/doctor/auth', doctorAuthRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/doctor/chat', doctorChatRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/chat', chatRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
