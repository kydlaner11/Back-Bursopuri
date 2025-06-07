const prisma = require('../../database/connection');
const supabase = require('../middleware/supabase');
const { createError, BAD_REQUEST, NOT_FOUND, UNAUTHORIZED } = require('../helpers/errorHelpers');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_TTL = process.env.JWT_TTL || '1d';

// === REGISTER USER ===
const create = async (req, res, next) => {
  try {
    const { email, password, full_name, role } = req.body;
    
    if (!email || !password || !full_name || !role) {
      return next(createError({
        status: BAD_REQUEST,
        message: 'Email, password, dan full_name wajib diisi',
      }));
    }

    // 1. Cek apakah email sudah ada di Prisma
    const existingUser = await prisma.profile.findFirst({
      where: { email },
      select: { email: true }
    });

    if (existingUser) {
      return next(createError({
        status: BAD_REQUEST,
        message: 'Email sudah terdaftar',
      }));
    }

    // 2. Buat user di Supabase Auth
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { full_name },
      email_confirm: true
    });

    if (userError) {
      return next(createError({
        status: BAD_REQUEST,
        message: userError.message,
      }));
    }

    const user = userData.user;

    // 3. Simpan ke table profile
    const profile = await prisma.profile.create({
      data: {
        id: user.id,
        email: user.email,
        fullName: full_name,
        role: role,
        createdAt: new Date()
      }
    });

    res.json({
      ok: true,
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        full_name,
        role: profile.role,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    next(createError({
      status: BAD_REQUEST,
      message: error.message,
    }));
  }
};

// === LOGIN USER ===
const verify = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return next(createError({
        status: BAD_REQUEST,
        message: 'Email dan password wajib diisi',
      }));
    }

    // 1. Login via Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data?.user) {
      return next(createError({
        status: UNAUTHORIZED,
        message: 'Email atau password salah',
      }));
    }

    const user = data.user;

    // 2. Ambil data tambahan dari Prisma
    const profile = await prisma.profile.findUnique({
      where: { id: user.id }
    });

    if (!profile) {
      // Jika user ada di Supabase tapi tidak ada di profile table
      // Buat profile baru dengan role default
      const newProfile = await prisma.profile.create({
        data: {
          id: user.id,
          email: user.email,
          fullName: user.user_metadata?.full_name || email.split('@')[0],
          role: 'user',
          createdAt: new Date()
        }
      });
      
      profile = newProfile;
    }

    // 3. Buat JWT token dengan informasi lengkap
    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: profile.role,
      full_name: profile.fullName
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_TTL });

    res.json({
      ok: true,
      message: 'Login berhasil',
      user: {
        id: user.id,
        email: user.email,
        full_name: profile.fullName,
        role: profile.role,
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    next(createError({
      status: BAD_REQUEST,
      message: `Login failed: ${error.message}`,
    }));
  }
};

// === VERIFY TOKEN MIDDLEWARE ===
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return next(createError({
        status: UNAUTHORIZED,
        message: 'Access token required',
      }));
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Optional: Check if user still exists in database
    const profile = await prisma.profile.findUnique({
      where: { id: decoded.id }
    });

    if (!profile) {
      return next(createError({
        status: UNAUTHORIZED,
        message: 'User not found',
      }));
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: profile.role,
      full_name: profile.fullName
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(createError({
        status: UNAUTHORIZED,
        message: 'Token expired',
      }));
    }
    
    return next(createError({
      status: UNAUTHORIZED,
      message: 'Invalid token',
    }));
  }
};

// === CHECK USER PROFILE ===
const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true
      }
    });

    if (!profile) {
      return next(createError({
        status: NOT_FOUND,
        message: 'Profile not found',
      }));
    }

    res.json({
      ok: true,
      profile
    });
  } catch (error) {
    next(createError({
      status: BAD_REQUEST,
      message: error.message,
    }));
  }
};

// === GANTI PASSWORD ===
const changePassword = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { newPassword, currentPassword } = req.body;

    if (!userId || !newPassword) {
      return next(createError({
        status: BAD_REQUEST,
        message: 'newPassword wajib diisi',
      }));
    }

    // Optional: Verify current password first
    if (currentPassword) {
      const { error } = await supabase.auth.signInWithPassword({
        email: req.user.email,
        password: currentPassword,
      });

      if (error) {
        return next(createError({
          status: UNAUTHORIZED,
          message: 'Current password is incorrect',
        }));
      }
    }

    // Update password di Supabase
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword
    });

    if (error) {
      return next(createError({
        status: BAD_REQUEST,
        message: error.message,
      }));
    }

    res.json({
      ok: true,
      message: 'Password berhasil diubah',
    });
  } catch (error) {
    next(createError({
      status: BAD_REQUEST,
      message: `Change password failed: ${error.message}`,
    }));
  }
};

// === LOGOUT (Optional - untuk blacklist token jika diperlukan) ===
const logout = async (req, res, next) => {
  try {
    // Jika Anda ingin implement token blacklist, bisa ditambahkan di sini
    // Untuk sekarang, logout handled di frontend dengan menghapus token
    
    res.json({
      ok: true,
      message: 'Logout successful',
    });
  } catch (error) {
    next(createError({
      status: BAD_REQUEST,
      message: error.message,
    }));
  }
};

module.exports = {
  create,
  verify,
  verifyToken,
  getProfile,
  changePassword,
  logout,
};