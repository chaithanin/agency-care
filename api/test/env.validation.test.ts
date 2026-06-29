import assert from 'assert/strict';
import { validateEnv } from '../src/config/env.validation';

function testDevelopmentDefaults() {
  const env = validateEnv({});

  assert.equal(env.NODE_ENV, 'development');
  assert.equal(env.API_PORT, 3000);
  assert.equal(env.NOTIFY_ENABLED, false);
  assert.equal(env.CHECKIN_MAX_RADIUS_METERS, 200);
}

function testProductionRequiredSecrets() {
  assert.throws(
    () => validateEnv({ NODE_ENV: 'production' }),
    /Missing required production env vars: DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET/,
  );
}

function testProductionValidConfig() {
  const env = validateEnv({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://user:pass@example.com:5432/agency',
    JWT_ACCESS_SECRET: 'access-secret',
    JWT_REFRESH_SECRET: 'refresh-secret',
    CORS_ORIGIN: 'https://agency.example.com',
    API_PORT: '8080',
    NOTIFY_ENABLED: 'true',
  });

  assert.equal(env.NODE_ENV, 'production');
  assert.equal(env.API_PORT, 8080);
  assert.equal(env.NOTIFY_ENABLED, true);
}

function testRejectsBadPort() {
  assert.throws(() => validateEnv({ API_PORT: '99999' }), /API_PORT\/PORT/);
}

function testCorsOriginFlexibility() {
  assert.doesNotThrow(() => validateEnv({ CORS_ORIGIN: '*' }));
  assert.doesNotThrow(() => validateEnv({
    CORS_ORIGIN: 'https://one.example.com, https://two.example.com',
  }));
}

function testRejectsBadRadius() {
  assert.throws(() => validateEnv({ CHECKIN_MAX_RADIUS_METERS: 'nope' }), /CHECKIN_MAX_RADIUS_METERS/);
  assert.throws(() => validateEnv({ CHECKIN_MAX_RADIUS_METERS: '-1' }), /CHECKIN_MAX_RADIUS_METERS/);
}

testDevelopmentDefaults();
testProductionRequiredSecrets();
testProductionValidConfig();
testRejectsBadPort();
testCorsOriginFlexibility();
testRejectsBadRadius();

console.log('env.validation tests passed');
