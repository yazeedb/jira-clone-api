const clientSessions = require('client-sessions');
const csurf = require('csurf');
const { getEnvVariables } = require('./env');

const env = getEnvVariables();

exports.authMiddleware = (req, res, next) => {
  const session = req[env.sessionName];

  if (session && session.user) {
    next();
    return;
  }

  res.json({
    message: 'Not authenticated.',
    statusCode: 401
  });
};

exports.corsMiddleware = (req, res, next) => {
  res
    .header('Access-Control-Allow-Origin', env.corsDomain)
    .header('Access-Control-Allow-Credentials', 'true')
    .header(
      'Access-Control-Allow-Headers',
      `Origin, X-Requested-With, Content-Type, Accept, ${env.csrfCookieName}`
    );

  next();
};

exports.sessionMiddleware = clientSessions({
  cookieName: env.sessionName,
  secret: env.sessionSecret,
  duration: 5000,
  cookie: {
    maxAge: 5000,
    httpOnly: true
  }
});

exports.csrfMiddleware = csurf({
  cookie: true,
  value: (req) => req.cookies[env.csrfCookieName]
});

exports.csrfErrorHandler = (err, req, res, next) => {
  if (err.code !== 'EBADCSRFTOKEN') {
    return next(err);
  }

  res.json({
    message: 'Invalid CSRF Token. Form has been tampered with.',
    statusCode: 403
  });
};
