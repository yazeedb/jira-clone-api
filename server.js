const uniqId = require('uniqid');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const { OAuth2Client } = require('google-auth-library');
const cookieParser = require('cookie-parser');
const { getEnvVariables } = require('./env');
const {
  authMiddleware,
  sessionMiddleware,
  csrfMiddleware,
  csrfErrorHandler,
  latencyMiddleware
} = require('./middlewares');

const app = express();
const port = 8000;
const env = getEnvVariables();

app
  .use(bodyParser.urlencoded({ extended: false }))
  .use(bodyParser.json())

  .use(cookieParser())
  .use(sessionMiddleware)
  .use(csrfMiddleware)
  .use(csrfErrorHandler)
  .use(latencyMiddleware)

  .post('/login', (req, res) => {
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
        const db = JSON.parse(fs.readFileSync('./db.json'));
        const existingUser = db.users.find((u) => u.sub === sub);

        if (!existingUser) {
          const newUser = { sub, email, orgs: [] };

          db.users.push(newUser);
          req[env.sessionName] = { user: newUser };
          fs.writeFileSync('./db.json', JSON.stringify(db, null, 2));
        } else {
          req[env.sessionName] = { user: existingUser };
        }

        res.status(204).send();
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

  .post('/api/completeSignup', (req, res) => {
    const { user } = req[env.sessionName];
    const signupFormData = req.body;

    if (user.sub !== signupFormData.sub) {
      res.status(400).json({
        message: "Session and form Google IDs don't match!"
      });

      return;
    }

    const db = JSON.parse(fs.readFileSync('./db.json'));

    const existingUser = db.users.find(
      (u) => u.googleClientId === user.googleClientId
    );

    if (!existingUser) {
      res.status(404).json({
        message: 'User not found!'
      });
    } else {
      for (const key in signupFormData) {
        // ensure email is never overwritten
        if (key !== 'email') {
          existingUser[key] = signupFormData[key];
        }
      }

      fs.writeFileSync('./db.json', JSON.stringify(db, null, 2));

      req[env.sessionName] = { user: existingUser };

      res.status(204).send();
    }
  })

  .get('/api/orgs', (req, res) => {
    const { user } = req[env.sessionName];
    const db = JSON.parse(fs.readFileSync('./db.json'));
    const existingUser = db.users.find((u) => u.sub === user.sub);

    if (!existingUser) {
      res.status(400).json({
        message: 'User not found!'
      });
    } else {
      res.json({
        orgs: existingUser.orgs
      });
    }
  })
  .post('/api/orgs', (req, res) => {
    setTimeout(() => {
      const { org } = req.body;
      const { user } = req[env.sessionName];

      const db = JSON.parse(fs.readFileSync('./db.json'));
      const existingUser = db.users.find((u) => u.sub === user.sub);

      if (!existingUser) {
        res.status(400).json({
          message: 'User not found!'
        });
      } else {
        const orgId = uniqId();

        existingUser.orgs = [
          {
            id: orgId,
            ownerId: existingUser.sub,
            name: org,
            dateCreated: new Date(),
            projects: []
          }
        ];

        fs.writeFileSync('./db.json', JSON.stringify(db, null, 2));

        res.json({
          message: 'Org created!',
          orgId
        });
      }
    }, 1200);
  })
  .get('/api/orgs/:orgId/projects', (req, res) => {
    setTimeout(() => {
      // Find associated user
      const { user } = req[env.sessionName];
      const db = JSON.parse(fs.readFileSync('./db.json'));
      const existingUser = db.users.find((u) => u.sub === user.sub);

      // Find associated org
      const { orgId } = req.params;
      const org = existingUser.orgs.find((o) => o.id === orgId);

      if (!org) {
        res.status(404).json({
          message: 'No projects found!'
        });
      } else {
        res.json({
          projects: org.projects
        });
      }
    }, 1200);
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
