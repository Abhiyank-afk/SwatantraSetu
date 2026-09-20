import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js';
import workerRoutes from './routes/workers.js';
import bookingRoutes from './routes/bookings.js';
import platformRoutes from './routes/platform.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Allowed frontend URLs
const allowedOrigins = [
  'http://localhost:5173',
  'https://swatantrasetu-1.onrender.com'
];

// CORS configuration
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json({ limit: '100kb' }));
app.use(morgan('dev'));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Co-opConnect API',
    mode: mongoose.connection.readyState === 1 ? 'mongodb' : 'in-memory',
    lowData: true,
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api', platformRoutes);

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({
    message: 'Internal server error'
  });
});

// Start server
async function start() {
  const uri = process.env.MONGODB_URI;

  if (uri) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 2500
      });

      console.log('MongoDB connected');
    } catch (e) {
      console.warn(
        'MongoDB not available — serving in-memory sample data.',
        e.message
      );
    }
  }

  app.listen(PORT, () => {
    console.log(
      `Co-opConnect API listening on http://localhost:${PORT}`
    );
  });
}

start();
