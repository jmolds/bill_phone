/**
 * WebRTC Signaling Server for Bill's Phone App
 * Modern implementation with security best practices
 */

// TODO: Future: Add support for multi-person calls with Bill (group calls)
// TODO: Future: Implement push notification logic for available users
// TODO: Future: Add support for multi-person calls with Bill (group calls)
// TODO: Future: Implement push notification logic for available users
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const { createLogger, format, transports } = require('winston');

// Environment variables with defaults
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? 
  process.env.ALLOWED_ORIGINS.split(',') : 
  ['http://localhost:19000', 'http://localhost:19001', 'http://localhost:3000', 'null'];

// Configure logger
const logger = createLogger({
  level: NODE_ENV === 'production' ? 'info' : 'debug',
  format: format.combine(
    format.timestamp(),
    format.printf(({ level, message, timestamp }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'signaling-server.log' })
  ],
});

// Initialize Express app with security middleware
const app = express();
app.use(helmet());
app.use(cors({
  origin: ALLOWED_ORIGINS,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true
}));
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO with security settings
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  },
  connectTimeout: 10000,
  pingTimeout: 5000,
  pingInterval: 10000,
  maxHttpBufferSize: 1e6, // 1MB
});

// Store active connections with additional metadata
const connectedUsers = new Map();

// Rate limiting for connection attempts
const connectionAttempts = new Map();
const MAX_CONNECTIONS_PER_MINUTE = 10;
const CONNECTION_WINDOW_MS = 60000; // 1 minute

// Helper function to get target socket
const getTargetSocket = (targetId) => {
  if (connectedUsers.has(targetId)) {
    return connectedUsers.get(targetId).socket;
  }
  return null;
};

// Helper function to log all connected users (for debugging)
const logConnectedUsers = () => {
  logger.debug('Connected users:');
  for (const [id, userData] of connectedUsers.entries()) {
    if (typeof id === 'string' && (id.length < 20 || id === userData.socketId)) {
      logger.debug(`  ${id} -> ${userData.customId || 'No custom ID'}`);
    }
  }
};

// Connection middleware for rate limiting
io.use((socket, next) => {
  const clientIp = socket.handshake.address;
  
  // Track connection attempts
  const now = Date.now();
  const clientData = connectionAttempts.get(clientIp) || { count: 0, resetTime: now + CONNECTION_WINDOW_MS };
  
  // Reset counter if window expired
  if (now > clientData.resetTime) {
    clientData.count = 1;
    clientData.resetTime = now + CONNECTION_WINDOW_MS;
  } else {
    clientData.count += 1;
  }
  
  connectionAttempts.set(clientIp, clientData);
  
  // Check if rate limit exceeded
  if (clientData.count > MAX_CONNECTIONS_PER_MINUTE) {
    logger.warn(`Rate limit exceeded for ${clientIp}`);
    return next(new Error('Rate limit exceeded'));
  }
  
  next();
});

// Socket.io connection handler
io.on('connection', (socket) => {
  const socketId = socket.id;
  logger.info(`User connected: ${socketId}`);
  logEvent('USER_CONNECTED', { socketId, ip: socket.handshake.address, userAgent: socket.handshake.headers['user-agent'] || 'Unknown' });
  
  // Store user connection with timestamp and metadata
  connectedUsers.set(socketId, { 
    socket,
    socketId, 
    customId: null, // Will be set on register if provided
    connectedAt: new Date().toISOString(),
    ip: socket.handshake.address,
    userAgent: socket.handshake.headers['user-agent'] || 'Unknown'
  });
  
  // Notify the user of their own ID
  socket.emit('connectionEstablished', { id: socketId });
  
  // Handle device registration with custom ID
  socket.on('register', (data) => {
    if (data.deviceId) {
      const customId = data.deviceId;
      logger.info(`User ${socketId} registered with custom ID: ${customId}`);
      logEvent('REGISTER', { socketId, customId });
      
      // Store the custom ID for this socket
      const userData = connectedUsers.get(socketId);
      if (userData) {
        userData.customId = customId;
        connectedUsers.set(socketId, userData);
        
        // Also create a mapping from custom ID to socket ID
        connectedUsers.set(customId, userData);
      }
    }
  });
  
  // Handle makeCall event
  socket.on('makeCall', ({ to, offer }) => {
    logger.info(`Call request from ${socketId} to ${to}`);
    logEvent('CALL_REQUEST', { from: socketId, to });
    
    const targetSocket = getTargetSocket(to);
    if (targetSocket) {
      // Direct messaging to the specific recipient
      targetSocket.emit('incomingCall', {
        from: socketId,
        offer
      });
      logger.debug(`Forwarded call offer to ${to}`);
    } else {
      // Recipient not found
      socket.emit('callError', {
        message: 'Recipient not found or offline',
        code: 'RECIPIENT_UNAVAILABLE'
      });
      logger.debug(`Recipient ${to} not found or offline`);
    }
  });
  
  // Handle answerCall event
  socket.on('answerCall', ({ to, answer }) => {
    logger.info(`Call answered from ${socketId} to ${to}`);
    logEvent('CALL_ANSWERED', { from: socketId, to });
    
    const targetSocket = getTargetSocket(to);
    if (targetSocket) {
      targetSocket.emit('callAccepted', {
        from: socketId,
        answer
      });
      logger.debug(`Forwarded call answer to ${to}`);
    } else {
      socket.emit('callError', {
        message: 'Caller not found or disconnected',
        code: 'CALLER_DISCONNECTED'
      });
    }
  });
  
  // Handle ICE candidates
  socket.on('iceCandidate', ({ to, candidate }) => {
    logger.debug(`ICE candidate from ${socketId} to ${to}`);

    
    const targetSocket = getTargetSocket(to);
    if (targetSocket) {
      targetSocket.emit('iceCandidate', {
        from: socketId,
        candidate
      });
    }
  });
  
  // Handle end call
  socket.on('endCall', ({ to }) => {
    logger.info(`Call ended by ${socketId}`);
    logEvent('CALL_ENDED', { from: socketId, to });
    
    const targetSocket = getTargetSocket(to);
    if (targetSocket) {
      targetSocket.emit('callEnded', {
        from: socketId
      });
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', (reason) => {
    logger.info(`User disconnected: ${socketId}, reason: ${reason}`);
    logEvent('USER_DISCONNECTED', { socketId, reason });
    
    // Notify interested parties about the disconnection
    for (const [id, userData] of connectedUsers.entries()) {
      if (id !== socketId && userData.socket) {
        userData.socket.emit('userDisconnected', {
          socketId: socketId,
          reason: reason
        });
      }
    }
    
    // Remove from active connections
    connectedUsers.delete(socketId);
  });
});

// --- PostgreSQL Integration ---
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const dbPool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'billphone',
  user: process.env.POSTGRES_USER || 'billuser',
  password: process.env.POSTGRES_PASSWORD || 'secretpassword',
  max: 5,
});

// --- Event Logging Helper ---
async function logEvent(event_type, details) {
  try {
    await dbPool.query(
      'INSERT INTO event_log (event_type, details) VALUES ($1, $2);',
      [event_type, typeof details === 'object' ? JSON.stringify(details) : String(details)]
    );
  } catch (err) {
    logger.error('Failed to log event: ' + err.message);
  }
}

async function ensureFamilyUsersTableExists() {
  try {
    // Create the table if it doesn't exist
    const result = await dbPool.query(`
      CREATE TABLE IF NOT EXISTS family_users (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        picture_data BYTEA,
        email TEXT,
        availability JSONB,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL
      );
    `);

    // Ensure 'email' is nullable and not unique (drop NOT NULL and UNIQUE constraints if present)
    await dbPool.query(`
      DO $$
      BEGIN
        -- Drop NOT NULL constraint if present
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='family_users' AND column_name='email' AND is_nullable='NO'
        ) THEN
          EXECUTE 'ALTER TABLE family_users ALTER COLUMN email DROP NOT NULL';
        END IF;
        -- Drop UNIQUE constraint if present
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'family_users_email_key'
        ) THEN
          EXECUTE 'ALTER TABLE family_users DROP CONSTRAINT family_users_email_key';
        END IF;
      END
      $$;
    `);

    // Ensure the unique constraint exists
    await dbPool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'unique_name'
        ) THEN
          ALTER TABLE family_users ADD CONSTRAINT unique_name UNIQUE (name);
          RAISE NOTICE 'Added unique_name constraint';
        ELSE
          RAISE NOTICE 'unique_name constraint already exists';
        END IF;
      END
      $$;
    `);

    // Add a default user if none exists
    await dbPool.query(`
      INSERT INTO family_users (id, name, picture_url, email, availability, created_at, updated_at)
      SELECT gen_random_uuid(), 'Justin', NULL, NULL, 
        '{"Sun": [17,18,19,20,21], "Mon": [17,18,19,20,21], "Tue": [17,18,19,20,21], "Wed": [17,18,19,20,21], "Thu": [17,18,19,20,21], "Fri": [17,18,19,20,21], "Sat": [17,18,19,20,21]}',
        NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM family_users WHERE name = 'Justin');
    `);
    
    logger.info('Ensured family_users table exists with unique constraint and default user');
    return result;
  } catch (error) {
    logger.error('Error ensuring family_users table exists:', error);
    throw error;
  }
}

ensureFamilyUsersTableExists();

// --- Family User API Endpoints ---
// Create or update a family user profile
const sharp = require('sharp');
// Helper: decode base64 image to Buffer
function decodeBase64Image(dataString) {
  if (!dataString) return null;
  const matches = dataString.match(/^data:(.+);base64,(.+)$/);
  if (!matches || matches.length !== 3) return null;
  return Buffer.from(matches[2], 'base64');
}

app.post('/family-users', async (req, res) => {
  let { id, name, picture_data, email, availability } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Missing required field: name' });
  }
  if (!email) email = null;
  let imageBuffer = null;
  if (picture_data) {
    logger.debug(`[POST /family-users] Received image data for user '${name}' (unknown bytes)`);
    // Accept either base64 string or raw binary
    if (typeof picture_data === 'string') {
      imageBuffer = decodeBase64Image(picture_data);
      logger.debug(`[POST /family-users] Decoded base64 image for user '${name}', buffer size: ${imageBuffer ? imageBuffer.length : 0} bytes`);
    } else if (Buffer.isBuffer(picture_data)) {
      imageBuffer = picture_data;
      logger.debug(`[POST /family-users] Received binary buffer for user '${name}', buffer size: ${imageBuffer.length} bytes`);
    }
    // Convert to JPEG using sharp
    try {
      logger.debug(`[POST /family-users] Converting image to JPEG for user '${name}'...`);
      imageBuffer = await sharp(imageBuffer).jpeg().toBuffer();
      logger.debug(`[POST /family-users] JPEG conversion complete for user '${name}', buffer size: ${imageBuffer.length} bytes`);
    } catch (err) {
      logger.error(`[POST /family-users] Error converting image to JPEG for user '${name}':`, err);
      return res.status(400).json({ error: 'Invalid image upload' });
    }
  }
  try {
    let result;
    if (email) {
      result = await dbPool.query(`
        INSERT INTO family_users (id, name, picture_data, email, availability, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (email) DO UPDATE SET
          name = EXCLUDED.name,
          picture_data = EXCLUDED.picture_data,
          availability = EXCLUDED.availability,
          updated_at = NOW()
        RETURNING *;
      `, [id || uuidv4(), name, imageBuffer, email, availability]);
    } else {
      result = await dbPool.query(`
        INSERT INTO family_users (id, name, picture_data, availability, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT (name) DO UPDATE SET
          picture_data = EXCLUDED.picture_data,
          availability = EXCLUDED.availability,
          updated_at = NOW()
        RETURNING *;
      `, [id || uuidv4(), name, imageBuffer, availability]);
    }
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('POST /family-users: ' + err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// Serve profile image as binary
dbPool.on('error', (err) => logger.error('PG Pool error', err));

app.get('/family-users/:id/picture', async (req, res) => {
  try {
    logger.debug(`[GET /family-users/${req.params.id}/picture] Fetching image from DB...`);
    const result = await dbPool.query('SELECT picture_data FROM family_users WHERE id = $1', [req.params.id]);
    if (!result.rows.length || !result.rows[0].picture_data) {
      logger.warn(`[GET /family-users/${req.params.id}/picture] No image found in DB.`);
      return res.status(404).send('No image');
    }
    logger.debug(`[GET /family-users/${req.params.id}/picture] Serving image, buffer size: ${result.rows[0].picture_data.length} bytes`);
    res.set('Content-Type', 'image/jpeg');
    res.send(result.rows[0].picture_data);
  } catch (err) {
    logger.error('GET /family-users/:id/picture: ' + err.message);
    res.status(500).send('Error retrieving image');
  }
});

// List all family users
app.get('/family-users', async (req, res) => {
  try {
    const result = await dbPool.query('SELECT * FROM family_users ORDER BY name ASC;');
    res.json(result.rows);
  } catch (err) {
    logger.error('GET /family-users: ' + err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get a single family user by id
app.get('/family-users/:id', async (req, res) => {
  try {
    const result = await dbPool.query('SELECT * FROM family_users WHERE id = $1;', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('GET /family-users/:id: ' + err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update a family user profile (name, picture_url, email, availability)
app.patch('/family-users/:id', async (req, res) => {
  const { name, picture_url, email, availability } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Missing required field: name' });
  }
  try {
    const result = await dbPool.query(
      `UPDATE family_users
       SET name = $1,
           picture_url = $2,
           email = $3,
           availability = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *;`,
      [name, picture_url, email, availability, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('PATCH /family-users/:id: ' + err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete a family user by ID
app.delete('/family-users/:id', async (req, res) => {
  try {
    const result = await dbPool.query('DELETE FROM family_users WHERE id = $1 RETURNING *;', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true, deleted: result.rows[0] });
    logEvent('PROFILE_DELETED', { id: result.rows[0].id, name: result.rows[0].name, email: result.rows[0].email });
  } catch (err) {
    logger.error('DELETE /family-users/:id: ' + err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update availability for a family user
app.patch('/family-users/:id/availability', async (req, res) => {
  const { availability } = req.body;
  if (!availability) {
    return res.status(400).json({ error: 'Missing availability' });
  }
  try {
    const result = await dbPool.query(
      'UPDATE family_users SET availability = $1, updated_at = NOW() WHERE id = $2 RETURNING *;',
      [availability, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('PATCH /family-users/:id/availability: ' + err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// API routes
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Bill\'s Phone WebRTC Signaling Server',
    connections: connectedUsers.size,
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`);
  logEvent('ERROR', { message: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
server.listen(PORT, () => {
  logger.info(`Signaling server running on port ${PORT} in ${NODE_ENV} mode`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  logger.error(err.stack);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise);
  logger.error('Reason:', reason);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  io.close(() => {
    logger.info('Socket.io server closed');
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  });
  
  // Force shutdown after timeout
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 5000);
});
