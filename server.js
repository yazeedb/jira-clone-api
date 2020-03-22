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

  .use(cookieParser())
  .use(corsMiddleware)
  .use(sessionMiddleware)
  .use(csrfMiddleware)
  .use(csrfErrorHandler)

  .post('/login', csrfMiddleware, async (req, res) => {
    const client = new OAuth2Client(env.googleClientId);
    const { idToken } = req.body;

    if (!idToken) {
      res.status(400).json({
        message: 'No Google ID Token found!'
      });

      return;
    }

    // Verify Google user
    client
      .verifyIdToken({
        idToken,
        audience: env.googleClientId
      })
      .then((loginTicket) => {
        // Find user in our DB
        const findUserQuery = `SELECT * FROM users WHERE googleId='${idToken}'`;

        dbConnection.query(findUserQuery, (error, results, fields) => {
          if (error) {
            throw error;
          }

          if (results.length === 0) {
            // Add user to DB
            const { sub, email } = loginTicket.getPayload();
            const sqlQuery = `INSERT INTO users (googleId, email) VALUES ("${sub}", "${email}")`;

            dbConnection.query(sqlQuery, (error, results, fields) => {
              if (error) {
                throw error;
              }

              console.log('results:', results);

              res.status(201).json({
                message: 'User created!',
                userId: sub
              });
            });
          }

          const [user] = results;

          req[env.sessionName] = { user };

          res.json({
            message: 'Success!',
            user
          });
        });
      })
      .catch((error) => {
        res.status(401).json({
          message: error.message
        });
      });
  })

  .use((req, res, next) => {
    console.log(req.cookies);

    next();
  })

  .get('/csrf-protection', (req, res) => {
    res
      .cookie(env.csrfCookieName, req.csrfToken())
      .status(204)
      .send();
  })

  .post('/fakeLogin', (req, res) => {
    const user = { id: 12345 };

    req[env.sessionName] = { user };

    res.json({
      user,
      message: 'Logged in'
    });
  })

  // Start protecting routes
  .use('/api/*', authMiddleware)

  .get('/api/user', (req, res) => {
    const { user } = req[env.sessionName];

    res.json({
      user
    });
  })

  .get('*', (req, res) => {
    res.status(404).json({
      message: 'Endpoint not found.'
    })
  })
  .listen(port, () => {
    console.log('Listening on port', port);
  });
