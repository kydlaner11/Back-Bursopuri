const { User } = require('../models');

const {
  createError,
  BAD_REQUEST,
  UNAUTHORIZED,
  NOT_FOUND,
} = require('../helpers/errorHelpers');

const postRegister = async (req, res, next) => {
  const props = req.body.user;

  try {
    let user = await User.findOne({ email: props.email });
    if (user) {
      return next(createError({
        status: BAD_REQUEST,
        message: 'Email already exists',
      }));
    }
    user = await User.create(props);
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
}

const postLogin = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(createError({
      status: BAD_REQUEST,
      message: 'Email and password are required',
    }));
  }

  try {
    const user = await User.verify(email.trim(), password);
    if (!user) {
      return next(createError({
        status: NOT_FOUND,
        message: 'User not found',
      }));
    }
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
}

module.exports = {
  postRegister,
  postLogin,
};