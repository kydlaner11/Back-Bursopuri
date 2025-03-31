const createError = ({
  status = 500,
  message = 'Internal Server Error'
}) => {
  const error = new Error(message);
  error.status = status;

  return error;
};

module.exports = {
  createError,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  GENERAL_ERROR: 500
};