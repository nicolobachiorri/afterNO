import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountService } from './accounts.ts';

test('Google account cookies, on google.com, country domains and YouTube', () => {
  assert.equal(accountService('__Secure-3PAPISID', '.google.com'), 'Google');
  assert.equal(accountService('__Secure-3PSID', '.google.it'), 'Google');
  assert.equal(accountService('SAPISID', '.google.co.uk'), 'Google');
  assert.equal(accountService('LOGIN_INFO', '.youtube.com'), 'Google');
});

test('cookies set for everyone are not account cookies', () => {
  assert.equal(accountService('NID', '.google.com'), undefined);
  assert.equal(accountService('datr', '.facebook.com'), undefined);
  assert.equal(accountService('bcookie', '.linkedin.com'), undefined);
});

test('the same name on another site is not an account cookie', () => {
  assert.equal(accountService('SID', '.example.com'), undefined);
  assert.equal(accountService('sessionid', '.example.com'), undefined);
  assert.equal(accountService('SID', '.notgoogle.com'), undefined);
});

test('other services', () => {
  assert.equal(accountService('c_user', '.facebook.com'), 'Facebook');
  assert.equal(accountService('li_at', '.www.linkedin.com'), 'LinkedIn');
  assert.equal(accountService('auth_token', '.x.com'), 'X');
  assert.equal(accountService('sessionid', '.instagram.com'), 'Instagram');
});
