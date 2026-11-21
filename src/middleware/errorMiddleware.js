
const errorMiddleware = (err, req, res, next) => {
  const allowedStatus = [400, 401, 403, 404, 409, 422, 500];

  const requestedStatus = Number(err.status) || 500;
  const status = allowedStatus.includes(requestedStatus)
    ? requestedStatus
    : 500;

  if (status >= 500) {
    console.error('[SERVER ERROR]', err);
  }

  const isProduction = process.env.NODE_ENV === 'prod' ||
    process.env.NODE_ENV === 'production';

  const message =
    status === 500 && isProduction
      ? 'Internal Server Error'
      : err.message || 'Internal Server Error';

  res.status(status).json({
    ok: false,
    message,
  });
};

module.exports = errorMiddleware;
