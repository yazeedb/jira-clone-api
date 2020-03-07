const express = require('express');
const clientSessions = require('client-sessions');
const bodyParser = require('body-parser');
const env = require('./env');

const app = express();
const twoSeconds = 2000;
const port = 8000;

const db = [
  {
    username: 'yazeed',
    password: '123'
  },
  {
    username: 'bill',
    password: '123'
  }
];

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(
  clientSessions({
    cookieName: env.sessionName,
    secret: env.secret,
    duration: twoSeconds,
    cookie: {
      maxAge: twoSeconds,
      httpOnly: true
    }
  })
);

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const existingUser = db.find(
    (u) => u.username === username && u.password === password
  );

  if (!existingUser) {
    return res.status(401).json({
      message: 'Username/password combo not found!'
    });
  }

  req[env.sessionName] = { username };

  return res.json({
    message: 'Success!'
  });
});

app.get('/user', (req, res) => {
  const { username } = req[env.sessionName];

  if (!username) {
    return res.status(401).json({
      message: 'Unauthorized'
    });
  }

  return res.json({
    username,
    message: 'Success!'
  });
});

app.listen(port, () => {
  console.log('Listening on port', port);
});
