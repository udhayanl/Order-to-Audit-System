import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import apiRouter from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { ensurePostgresRunning } from './db/pg-runner.js';
import prisma from './db/client.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security: Helmet HTTP Headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows inline scripts/styles for modern SPA client
    crossOriginEmbedderPolicy: false,
  })
);

// Performance: Gzip / Deflate compression
app.use(compression());

// CORS configuration
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parsing with safe size limits to prevent payload exhaustion attacks
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security & DoS Protection: General API rate limiting (disabled in test)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1500, // 1500 requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { success: false, message: 'Too many requests. Please slow down and try again after 15 minutes.' },
});
app.use('/api/', generalLimiter);

// Security: Strict rate limiter for Authentication login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // 50 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { success: false, message: 'Too many login attempts. Please try again after 15 minutes.' },
});
app.use('/api/auth/login', loginLimiter);

// Request logging in development
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    console.log(`[API] ${req.method} ${req.path}`);
    next();
  });
}

// Health check with live PostgreSQL verification
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'healthy',
      database: 'connected',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/api/health', (req, res) => {
  res.redirect(307, '/health');
});

// Main API Router
app.use('/api', apiRouter);

// Explicit 404 handler for unknown /api/* endpoints
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint '${req.method} ${req.originalUrl}' does not exist on this server.`,
  });
});

// Serve static frontend build if client/dist exists
const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) next();
  });
});

// Global Error Handler
app.use(errorHandler);

async function startServer() {
  try {
    // If not in test mode, ensure PostgreSQL is running
    if (process.env.NODE_ENV !== 'test') {
      await ensurePostgresRunning();
    }

    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(` FactoryFlow Server running on http://localhost:${PORT}`);
      console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
