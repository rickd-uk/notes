const jwt = require('jsonwebtoken');
const db = require('../db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('ERROR: JWT_SECRET environment variable is missing.');
  process.exit(1);
}

// Verifies JWT and, for DB users, checks suspended/invalidated_at.
// Skips DB lookup for .env legacy admin tokens (decoded.isAdmin === true).
const authenticate = async (req, res, next) => {
  const token = req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;

    // Legacy .env admin: skip DB checks
    if (decoded.isAdmin === true) {
      return next();
    }

    // DB user: check suspended and invalidated_at
    const result = await db.query(
      'SELECT suspended, invalidated_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    if (user.suspended) {
      return res.status(403).json({ error: 'Account suspended' });
    }

    if (user.invalidated_at) {
      const tokenIssuedAt = new Date(decoded.iat * 1000);
      if (tokenIssuedAt < new Date(user.invalidated_at)) {
        return res.status(401).json({ error: 'Session revoked' });
      }
    }

    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Requires the authenticated user to be rick.
const isAdmin = (req, res, next) => {
  if (!req.user || req.user.username !== 'rick') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = { authenticate, isAdmin };
