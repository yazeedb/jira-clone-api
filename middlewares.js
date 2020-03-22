const clientSessions = require('client-sessions');
const csurf = require('csurf');

const { getEnvVariables } = require('./env');

const env = getEnvVariables();

exports.authMiddleware = (req, res, next) => {
  const { user } = req[env.sessionName];

  if (!user) {
    res.status(401).json({
      message: 'Not authenticated.'
    });

    return;
  }

  next();
};

exports.corsMiddleware = (req, res, next) => {
  console.log('passing through cors middleware');
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header(
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

exports.csurfMiddleware = csurf({
  cookie: true,
  value: (req) => req.cookies[env.csrfCookieName]
});
