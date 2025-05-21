const { create, verify } = require('../models/userModel');
const {
  createError,
  BAD_REQUEST,
  UNAUTHORIZED,
  NOT_FOUND,
} = require('../helpers/errorHelpers');

const postRegister = async (req, res, next) => {
  const props = req.body.user;

  try {
    const user = await create(props);
    res.json({
      ok: true,
      message: 'Registration successfully',
      user,
    });
  } catch (error) {
    next(createError({
      status: BAD_REQUEST,
      message: error.message,
    }));
  }
};

const postLogin = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(createError({
      status: BAD_REQUEST,
      message: 'Email and password are required',
    }));
  }

  try {
    const user = await verify(email.trim(), password);
    res.json({
      ok: true,
      message: 'Login successfully',
      token: user.token,
    });
  } catch (error) {
    next(createError({
      status: UNAUTHORIZED,
      message: error.message,
    }));
  }
};

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.split(' ')[1]; // Extract token from "Bearer <token>"
  
  try {
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Add user to request object
    req.user = user;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to authenticate token' });
  }
};

// Role-based middleware
const checkRole = (roles) => {
  return async (req, res, next) => {
    try {
      // Fetch user role from database
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', req.user.id)
        .single();
      
      if (error) {
        return res.status(500).json({ error: 'Failed to fetch user role' });
      }
      
      // Check if user has required role
      if (!roles.includes(data.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      next();
    } catch (err) {
      return res.status(500).json({ error: 'Server error' });
    }
  };
};

module.exports = {
  postRegister,
  postLogin,
  verifyToken,
  checkRole,
};