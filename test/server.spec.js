const request = require('supertest');
const { getEnvVariables } = require('../env');
const { app } = require('../server');
const { getCookieHeaders } = require('./utils');

const env = getEnvVariables();

describe('server', () => {
  it('provides CSRF protection', (done) => {
    request(app)
      .get('/csrf-protection')
      .end((err, res) => {
        if (err) {
          throw err;
        }

        const cookieHeaders = getCookieHeaders(res.header['set-cookie']);

        expect(cookieHeaders.includes('_csrf')).toBe(true);
        expect(cookieHeaders.includes(env.csrfCookieName)).toBe(true);
        expect(res.status).toBe(204);

        done();
      });
  });

  describe('login', () => {
    it('provides CSRF protection', (done) => {
      request(app)
        .get('/api/login')
        .end((err, res) => {
          if (err) {
            throw err;
          }
          console.log(res);

          const cookieHeaders = getCookieHeaders(res.header['set-cookie']);

          expect(cookieHeaders.includes('_csrf')).toBe(true);
          expect(cookieHeaders.includes(env.csrfCookieName)).toBe(true);
          expect(res.status).toBe(204);

          done();
        });
    });
  });
});
