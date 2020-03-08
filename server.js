const express = require('express');
const clientSessions = require('client-sessions');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const { OAuth2Client } = require('google-auth-library');
const csurf = require('csurf');
const cookieParser = require('cookie-parser');
const { getEnvVariables } = require('./env');

const app = express();
const twoSeconds = 2000;
const port = 8000;
const env = getEnvVariables();

const dbConnection = mysql.createConnection({
  host: env.db.host,
  user: env.db.username,
  password: env.db.password,
  database: env.db.dbName,
  port: env.db.port
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, X-XSRF-TOKEN'
  );
  next();
});

app.use(
  clientSessions({
    cookieName: env.sessionName,
    secret: env.sessionSecret,
    duration: twoSeconds,
    cookie: {
      maxAge: twoSeconds,
      httpOnly: true
    }
  })
);

app.use(cookieParser());

app.use(csurf({ cookie: true }));

app.get('/csrf-protection', (req, res) => {
  res.cookie('XSRF-TOKEN', req.csrfToken());

  return res.status(204).send();
});

app.post('/signupViaGoogle', (req, res) => {
  const client = new OAuth2Client(env.googleClientId);
  const { idToken } = req.body;

  client
    .verifyIdToken({
      idToken,
      audience: env.googleClientId
    })
    .then((ticket) => {
      const { sub, email } = ticket.getPayload();
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
    })
    .catch(console.warn);
});

app.post('/login', (req, res) => {
  const { idToken } = req.body;
  const sqlQuery = `SELECT * FROM users WHERE googleId='${idToken}'`;

  dbConnection.query(sqlQuery, (error, results, fields) => {
    if (error) {
      throw error;
    }

    if (results.length === 0) {
      res.status(401).json({
        message: 'User not found!'
      });

      return;
    }

    const [user] = results;

    req[env.sessionName] = { user };

    res.json({
      message: 'Success!',
      user
    });
  });
});

app.get('/user', (req, res) => {
  const { user } = req[env.sessionName];

  if (!user) {
    res.status(401).json({
      message: 'Unauthorized'
    });

    return;
  }

  res.json({
    user,
    message: 'Success!'
  });
});

app.listen(port, () => {
  console.log('Listening on port', port);
});
