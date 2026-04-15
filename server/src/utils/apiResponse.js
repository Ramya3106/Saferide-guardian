const success = (res, status, message, data = {}) => {
  return res.status(status).json({
    ok: true,
    message,
    data,
  });
};

const failure = (res, status, message, error = null, details = null) => {
  return res.status(status).json({
    ok: false,
    message,
    error,
    details,
  });
};

module.exports = {
  success,
  failure,
};
