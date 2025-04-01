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

module.exports = {
  postRegister,
  postLogin,
};