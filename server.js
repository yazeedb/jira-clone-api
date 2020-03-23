const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const { OAuth2Client } = require('google-auth-library');
const cookieParser = require('cookie-parser');
const { getEnvVariables } = require('./env');
const {
  authMiddleware,
  corsMiddleware,
  sessionMiddleware,
  csrfMiddleware,
  csrfErrorHandler
} = require('./middlewares');

const app = express();
const port = 8000;
const env = getEnvVariables();

const dbConnection = mysql.createConnection({
  host: env.db.host,
  user: env.db.username,
  password: env.db.password,
  database: env.db.dbName,
  port: env.db.port
});

app
  .use(bodyParser.urlencoded({ extended: false }))
  .use(bodyParser.json())

  // .use(corsMiddleware)
  .use(cookieParser())
  .use(sessionMiddleware)
  .use(csrfMiddleware)
  .use(csrfErrorHandler)

  .post('/login', async (req, res) => {
    const client = new OAuth2Client(env.googleClientId);
    const { idToken } = req.body;

    if (!idToken) {
      res.status(400).json({
        message: 'No Google ID Token found!'
      });

      return;
    }

    client
      // Verify Google user
      .verifyIdToken({
        idToken,
        audience: env.googleClientId
      })
      .then((loginTicket) => loginTicket.getPayload())
      .then(({ sub, email }) => {
        // Find user in DB
        const findUserQuery = `SELECT * FROM users WHERE googleId='${sub}'`;

        dbConnection.query(findUserQuery, (error, results, fields) => {
          if (error) {
            throw error;
          }

          if (results.length === 0) {
            // Add user if not exists
            const sqlQuery = `INSERT INTO users (googleId, email) VALUES ("${sub}", "${email}")`;

            dbConnection.query(sqlQuery, (error, results, fields) => {
              if (error) {
                throw error;
              }
            });
          }

          const [user] = results;

          req[env.sessionName] = { user };

          res.json({
            message: 'Success!'
          });
        });
      })
      .catch((error) => {
        res.status(401).json({
          message: error.message
        });
      });
  })

  // Start protecting routes
  .use('/api/*', authMiddleware)

  .get('/api/user', (req, res) => {
    res.json(req[env.sessionName]);
  })

  .all('*', (req, res, next) => {
    res.cookie(env.csrfCookieName, req.csrfToken());

    next();
  })

  .use((req, res) => {
    res.status(404).json({
      message: 'Endpoint not found.'
    });
  });

// Don't go live during tests
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log('Listening on port', port);
  });
}

// Allow tests to import Express app
exports.app = app;
