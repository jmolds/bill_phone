/**
 * WebRTC Signaling Server for Bill's Phone App
 * Modern implementation with security best practices and iOS compatibility
 */

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
  ['http://localhost:19000', 'http://localhost:19001', 'http://localhost:3000', 'https://api.justinmolds.com', 'null'];

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

// Enhanced CORS configuration for iOS compatibility
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:19000',
      'http://localhost:19001', 
      'http://localhost:3000',
      'https://api.justinmolds.com',
      'https://localhost:3000', // For local HTTPS testing
      /^https:\/\/.*\.expo\.dev$/, // Expo development URLs
      /^https:\/\/.*\.ngrok\.io$/, // Ngrok tunnels for testing
    ];
    
    const isAllowed = allowedOrigins.some(allowed => {
      return typeof allowed === 'string' ? allowed === origin : allowed.test(origin);
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      logger.warn(`CORS rejected origin: ${origin}`);
      callback(null, true); // Allow all in development - restrict in production
    }
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With', 
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma',
    'User-Agent',
    'X-Platform'
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Create HTTP server
const server = http.createServer(app);

// Enhanced Socket.IO configuration for iOS compatibility
const io = new Server(server, {
  cors: corsOptions,
  
  // Connection timeouts - more lenient for mobile
  connectTimeout: 60000, // 60 seconds
  pingTimeout: 30000,    // 30 seconds  
  pingInterval: 25000,   // 25 seconds
  
  // Transport configuration - prioritize polling for iOS reliability
  transports: ['polling', 'websocket'],
  
  // Allow upgrades but don't force them
  allowUpgrades: true,
  upgradeTimeout: 10000,
  
  // Enhanced buffer sizes for iOS
  maxHttpBufferSize: 2e6, // 2MB
  
  // Connection state recovery for mobile apps
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true,
  },
  
  // Additional mobile-friendly options
  cookie: false, // Disable cookies for mobile apps
  serveClient: false, // Don't serve socket.io client
  
  // Polling configuration for iOS compatibility
  polling: {
    duration: 20,
    maxHttpBufferSize: 2e6
  }
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
      logger.debug(`  ${id} -> ${userData.customId || 'No custom ID'} (${userData.platform || 'unknown'})`);
    }
  }
};

// Enhanced connection middleware with iOS detection
io.use((socket, next) => {
  const userAgent = socket.handshake.headers['user-agent'] || '';
  const platform = socket.handshake.query.platform || '';
  const clientIp = socket.handshake.address;
  
  // Log connection attempt details
  logger.info(`Connection attempt from ${clientIp}, Platform: ${platform}, UA: ${userAgent.substring(0, 100)}`);
  
  // Enhanced rate limiting with iOS considerations
  const now = Date.now();
  const clientData = connectionAttempts.get(clientIp) || { count: 0, resetTime: now + CONNECTION_WINDOW_MS };
  
  if (now > clientData.resetTime) {
    clientData.count = 1;
    clientData.resetTime = now + CONNECTION_WINDOW_MS;
  } else {
    clientData.count += 1;
  }
  
  connectionAttempts.set(clientIp, clientData);
  
  // More lenient rate limiting for iOS apps
  const maxConnections = platform === 'ios' ? MAX_CONNECTIONS_PER_MINUTE * 2 : MAX_CONNECTIONS_PER_MINUTE;
  
  if (clientData.count > maxConnections) {
    logger.warn(`Rate limit exceeded for ${clientIp} (Platform: ${platform})`);
    return next(new Error('Rate limit exceeded'));
  }
  
  next();
});

// Enhanced Socket.io connection handler
io.on('connection', (socket) => {
  const socketId = socket.id;
  const userAgent = socket.handshake.headers['user-agent'] || '';
  const platform = socket.handshake.query.platform || 'unknown';
  const version = socket.handshake.query.version || 'unknown';
  const buildNumber = socket.handshake.query.buildNumber || 'unknown';
  
  logger.info(`✅ User connected: ${socketId}, Platform: ${platform}, Version: ${version}, Build: ${buildNumber}`);
  logEvent('USER_CONNECTED', { socketId, ip: socket.handshake.address, userAgent: userAgent.substring(0, 200), platform, version, buildNumber });
  
  // Enhanced user metadata for iOS
  connectedUsers.set(socketId, { 
    socket,
    socketId, 
    customId: null,
    platform,
    version,
    buildNumber,
    connectedAt: new Date().toISOString(),
    ip: socket.handshake.address,
    userAgent: userAgent.substring(0, 200), // Truncate long user agents
    lastPing: Date.now()
  });
  
  // Send enhanced connection confirmation
  socket.emit('connectionEstablished', { 
    id: socketId,
    serverTime: new Date().toISOString(),
    platform: platform,
    supportedFeatures: ['video', 'audio', 'heartbeat']
  });
  
  // iOS-specific heartbeat handling
  socket.on('ping', (data) => {
    const userData = connectedUsers.get(socketId);
    if (userData) {
      userData.lastPing = Date.now();
      connectedUsers.set(socketId, userData);
    }
    socket.emit('pong', { timestamp: data.timestamp });
  });
  
  // Enhanced register handler with iOS metadata
  socket.on('register', (data) => {
    const customId = data.deviceId;
    logger.info(`📱 Device registered: ${socketId} -> ${customId} (${platform} v${version})`);
    logEvent('REGISTER', { socketId, customId, platform, version });
    
    const userData = connectedUsers.get(socketId);
    if (userData) {
      userData.customId = customId;
      userData.registeredAt = new Date().toISOString();
      connectedUsers.set(socketId, userData);
      connectedUsers.set(customId, userData);
    }
    
    // Send registration confirmation
    socket.emit('registered', {
      deviceId: customId,
      timestamp: new Date().toISOString()
    });
  });
  
  // Enhanced makeCall event with iOS support
  socket.on('makeCall', ({ to, offer }) => {
    logger.info(`📞 Call request: ${socketId} -> ${to} (Platform: ${platform})`);
    logEvent('CALL_REQUEST', { from: socketId, to, platform });
    
    const targetSocket = getTargetSocket(to);
    if (targetSocket) {
      targetSocket.emit('incomingCall', {
        from: socketId,
        offer,
        callerPlatform: platform,
        timestamp: new Date().toISOString()
      });
      
      // Send call progress to caller
      socket.emit('callProgress', {
        status: 'ringing',
        target: to
      });
      
      logger.debug(`Forwarded call offer to ${to}`);
    } else {
      socket.emit('callError', {
        message: 'Recipient not found or offline',
        code: 'RECIPIENT_UNAVAILABLE',
        target: to
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
  
  // Enhanced disconnect handling
  socket.on('disconnect', (reason) => {
    logger.info(`❌ User disconnected: ${socketId}, reason: ${reason}, platform: ${platform}`);
    logEvent('USER_DISCONNECTED', { socketId, reason, platform });
    
    // Log extended disconnect info for debugging iOS issues
    const userData = connectedUsers.get(socketId);
    if (userData) {
      const connectionDuration = Date.now() - new Date(userData.connectedAt).getTime();
      logger.info(`Connection duration: ${Math.round(connectionDuration / 1000)}s, Last ping: ${Date.now() - userData.lastPing}ms ago`);
    }
    
    // Clean up heartbeat interval if exists
    if (socket.heartbeatInterval) {
      clearInterval(socket.heartbeatInterval);
    }
    
    // Notify interested parties about the disconnection
    for (const [id, user] of connectedUsers.entries()) {
      if (id !== socketId && user.socket && typeof id === 'string') {
        user.socket.emit('userDisconnected', {
          socketId: socketId,
          reason: reason,
          platform: platform
        });
      }
    }
    
    // Remove from active connections
    if (userData && userData.customId) {
      connectedUsers.delete(userData.customId);
    }
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

// Debug: log all incoming POST/PATCH payloads for /family-users
function logUserPayload(route, body) {
  try {
    const preview = { ...body };
    if (preview.picture_data && typeof preview.picture_data === 'string') {
      preview.picture_data = `base64 string, length: ${preview.picture_data.length}`;
    }
    logger.info(`[${route}] Incoming payload: ` + JSON.stringify(preview));
  } catch (err) {
    logger.warn(`[${route}] Could not stringify payload: ` + err.message);
  }
}

// Shared image processing helper
async function processProfileImage(picture_data, logPrefix = '') {
  if (!picture_data) return null;
  const loggerPrefix = logPrefix ? `[${logPrefix}] ` : '';
  const buffer = decodeBase64Image(picture_data);
  if (!buffer) {
    logger.error(`${loggerPrefix}Failed to decode base64 image.`);
    throw new Error('Invalid image data');
  }
  logger.info(`${loggerPrefix}Decoded base64 image, buffer length: ${buffer.length}`);
  try {
    const processed = await sharp(buffer)
      .jpeg({ quality: 100 })
      .resize(400, 400, { fit: 'cover' })
      .toBuffer();
    logger.info(`${loggerPrefix}Converted image to JPEG, buffer length: ${processed.length}`);
    return processed;
  } catch (err) {
    logger.error(`${loggerPrefix}Sharp conversion failed: ${err.message}`);
    throw new Error('Image conversion failed');
  }
}

app.post('/family-users', async (req, res) => {
  logUserPayload('POST /family-users', req.body);
  let { id, name, picture_data, email, availability } = req.body;
  let imageBuffer = null;
  if (picture_data) {
    try {
      imageBuffer = await processProfileImage(picture_data, 'POST /family-users');
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  if (!name) {
    return res.status(400).json({ error: 'Missing required field: name' });
  }

  try {
    let result;
    logger.info(`[POST /family-users] Inserting/updating user: ${name}, id: ${id}, email: ${email || 'N/A'}, image buffer: ${imageBuffer ? imageBuffer.length : 0} bytes`);
    if (email) {
      result = await dbPool.query(`
        INSERT INTO family_users (id, name, picture_data, email, availability, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (email) DO UPDATE SET
          name = EXCLUDED.name,
          picture_data = COALESCE(EXCLUDED.picture_data, family_users.picture_data),
          availability = EXCLUDED.availability,
          updated_at = NOW()
        RETURNING *;
      `, [id || uuidv4(), name, imageBuffer, email, availability]);
    } else {
      if (imageBuffer) {
        // If new image provided, update it
        result = await dbPool.query(`
          INSERT INTO family_users (id, name, picture_data, availability, created_at, updated_at)
          VALUES ($1, $2, $3, $4, NOW(), NOW())
          ON CONFLICT (name) DO UPDATE SET
            picture_data = EXCLUDED.picture_data,
            availability = EXCLUDED.availability,
            updated_at = NOW()
          RETURNING *;
        `, [id || uuidv4(), name, imageBuffer, availability]);
      } else {
        // If no new image, do not overwrite picture_data
        result = await dbPool.query(`
          INSERT INTO family_users (id, name, picture_data, availability, created_at, updated_at)
          VALUES ($1, $2, NULL, $3, NOW(), NOW())
          ON CONFLICT (name) DO UPDATE SET
            availability = EXCLUDED.availability,
            updated_at = NOW()
          RETURNING *;
        `, [id || uuidv4(), name, availability]);
      }
    }
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('POST /family-users: ' + err.message);
    logger.error('POST /family-users: ' + (err.stack || 'No stack'));
    res.status(500).json({ error: 'Database error' });
  }
});

// Serve profile image as binary
dbPool.on('error', (err) => logger.error('PG Pool error', err));

app.get('/family-users/:id/picture', async (req, res) => {
  logger.info(`[GET /family-users/${req.params.id}/picture] Requested`);
  try {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    logger.debug(`[GET /family-users/${req.params.id}/picture] Fetching image from DB...`);
    logger.info(`[GET /family-users/${req.params.id}/picture] Querying DB for user image...`);
    const result = await dbPool.query('SELECT picture_data FROM family_users WHERE id = $1', [req.params.id]);
    let imageBuffer = result.rows[0]?.picture_data;
    logger.info(`[GET /family-users/${req.params.id}/picture] User image buffer: ${imageBuffer ? imageBuffer.length : 0} bytes`);
    if (!imageBuffer) {
      logger.warn(`[GET /family-users/${req.params.id}/picture] No image found for user, trying default user...`);
      // Try to fetch the default user's image by name (e.g., 'Justin')
      const defaultResult = await dbPool.query("SELECT picture_data FROM family_users WHERE name = $1 LIMIT 1", ['default_user']);
      imageBuffer = defaultResult.rows[0]?.picture_data;
      logger.info(`[GET /family-users/${req.params.id}/picture] Default user image buffer: ${imageBuffer ? imageBuffer.length : 0} bytes`);
      if (!imageBuffer) {
        logger.warn(`[GET /family-users/${req.params.id}/picture] No default image found in DB.`);
        return res.status(404).send('No image');
      }
      logger.debug(`[GET /family-users/${req.params.id}/picture] Serving default user's image.`);
      logger.info(`[GET /family-users/${req.params.id}/picture] Serving default user's image, buffer size: ${imageBuffer ? imageBuffer.length : 0} bytes`);
    } else {
      logger.debug(`[GET /family-users/${req.params.id}/picture] Serving user's image, buffer size: ${imageBuffer.length} bytes`);
      logger.info(`[GET /family-users/${req.params.id}/picture] Serving user's image, buffer size: ${imageBuffer.length} bytes`);
    }
    res.set('Content-Type', 'image/jpeg');
    res.send(imageBuffer);
  } catch (err) {
    logger.error('GET /family-users/:id/picture: ' + err.message);
    logger.error('GET /family-users/:id/picture: ' + (err.stack || 'No stack'));
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
  const { name, picture_data, picture_url, email, availability } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Missing required field: name' });
  }

  let imageBuffer = null;
  if (picture_data) {
    try {
      imageBuffer = await processProfileImage(picture_data, 'PATCH /family-users/:id');
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  try {
    let result;
    if (imageBuffer) {
      result = await dbPool.query(
        `UPDATE family_users
         SET name = $1,
             picture_data = $2,
             picture_url = $3,
             email = $4,
             availability = $5,
             updated_at = NOW()
         WHERE id = $6
         RETURNING *;`,
        [name, imageBuffer, picture_url, email, availability, req.params.id]
      );
    } else {
      result = await dbPool.query(
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
    }
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

// Debug/test endpoint for image upload
app.post('/test-image-upload', async (req, res) => {
  const { picture_data, name } = req.body;
  
  console.log('[TEST] Testing image upload for:', name);
  console.log('[TEST] Has picture_data:', !!picture_data);
  
  if (picture_data) {
    try {
      const matches = picture_data.match(/^data:(.+);base64,(.+)$/);
      if (!matches) {
        return res.status(400).json({ error: 'Invalid data URL format' });
      }
      
      const buffer = Buffer.from(matches[2], 'base64');
      const processedBuffer = await require('sharp')(buffer).jpeg({ quality: 100 }).toBuffer();
      
      res.json({
        success: true,
        originalSize: buffer.length,
        processedSize: processedBuffer.length,
        message: 'Image processing test successful'
      });
    } catch (error) {
      res.status(400).json({ error: 'Processing failed', details: error.message });
    }
  } else {
    res.json({ success: true, message: 'No image data - test passed' });
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

// Enhanced health check endpoint with iOS-specific info
app.get('/health', (req, res) => {
  const iosConnections = Array.from(connectedUsers.values())
    .filter(user => user.platform === 'ios').length;
  
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    totalConnections: connectedUsers.size,
    iosConnections: iosConnections,
    serverUptime: process.uptime()
  });
});

// iOS-specific debug endpoint
app.get('/debug/ios-connections', (req, res) => {
  const iosUsers = Array.from(connectedUsers.entries())
    .filter(([key, user]) => user.platform === 'ios' && typeof key === 'string' && key.length > 10)
    .map(([key, user]) => ({
      socketId: user.socketId,
      customId: user.customId,
      version: user.version,
      buildNumber: user.buildNumber,
      connectedAt: user.connectedAt,
      lastPing: new Date(user.lastPing).toISOString()
    }));
  
  res.json({
    totalIosConnections: iosUsers.length,
    connections: iosUsers
  });
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