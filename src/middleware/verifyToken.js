
const jwt = require('jsonwebtoken');
const prisma = require('../../database/connection');
const { JWT_SECRET } = require('../../config');

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        ok: false,
        message: 'Access token required',
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        ok: false,
        message: 'Invalid authorization header',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const profile = await prisma.profile.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
      },
    });

    if (!profile) {
      return res.status(401).json({
        ok: false,
        message: 'User profile not found',
      });
    }

    req.user = {
      id: profile.id,
      email: profile.email,
      full_name: profile.fullName,
      role: profile.role,
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        ok: false,
        message: 'Token expired',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        ok: false,
        message: 'Invalid token',
      });
    }

    next(error);
  }
};

module.exports = verifyToken;
