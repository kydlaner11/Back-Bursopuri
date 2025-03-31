const {
  BAD_REQUEST,
  UNAUTHORIZED,
  FORBIDDEN,
  NOT_FOUND,
  CONFLICT,
  UNPROCESSABLE,
  GENERAL_ERROR
} = require('../helpers/errorHelpers');

const unauthorized = (err, req, res, next) => {
  if (err.status === UNAUTHORIZED) return next(err);

  res.status(UNAUTHORIZED).send({
    ok: false,
    message: err.message || 'Unauthorized',
    error: [err],
  });
}

const forbidden = (err, req, res, next) => {
  if (err.status === FORBIDDEN) return next(err);

  res.status(FORBIDDEN).send({
    ok: false,
    message: err.message || 'Forbidden',
    error: [err],
  });
}

const badRequest = (err, req, res, next) => {
  if (err.status === BAD_REQUEST) return next(err);

  res.status(BAD_REQUEST).send({
    ok: false,
    message: err.message || 'Bad Request',
    error: [err],
  });
}

const conflict = (err, req, res, next) => {
  if (err.status === CONFLICT) return next(err);

  res.status(CONFLICT).send({
    ok: false,
    message: err.message || 'Conflict',
    error: [err],
  });
}

const notFound = (err, req, res, next) => {
  if (err.status === NOT_FOUND) return next(err);

  res.status(NOT_FOUND).send({
    ok: false,
    message: err.message || 'The requested resource could not be found',
    error: [err],
  });
}

const unprocessable = (err, req, res, next) => {
  if (err.status === UNPROCESSABLE) return next(err);

  res.status(UNPROCESSABLE).send({
    ok: false,
    message: err.message || 'Unprocessable Entity',
    error: [err],
  });
}

const genericError = (err, req, res, next) => {
  if (err.status === GENERAL_ERROR) return next(err);

  res.status(GENERAL_ERROR).send({
    ok: false,
    message: err.message || 'Internal Server Error',
    error: [err],
  });
}

const catchAll = (err, req, res, next) => {
  res.status(NOT_FOUND).send({
    ok: false,
    message: err.message || 'The requested resource could not be found',
  });
}

const exportable = {
  unauthorized,
  forbidden,
  badRequest,
  conflict,
  notFound,
  unprocessable,
  genericError,
  catchAll,
};


const all = Object.keys(exportable).map(key => exportable[key]);

module.exports = {
  ...exportable,
  all,
}
