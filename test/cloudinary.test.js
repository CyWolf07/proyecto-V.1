import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cloudinarySettings, signUpload, verifyNotification, validManifestUrl } from '../server/cloudinary-signatures.js';

test('Cloudinary solo queda listo con las cuatro variables requeridas', () => {
  assert.equal(cloudinarySettings({}).ready, false);
  assert.equal(cloudinarySettings({ CLOUDINARY_CLOUD_NAME:'demo', CLOUDINARY_API_KEY:'key',
    CLOUDINARY_API_SECRET:'secret', PUBLIC_BASE_URL:'https://kitsune.example' }).ready, true);
});

test('firma de subida ordenada y notificación auténtica', () => {
  const secret = 'test-secret';
  assert.equal(signUpload({ timestamp:'123', public_id:'kitsune/test' }, secret),
    createHash('sha1').update('public_id=kitsune/test&timestamp=123' + secret).digest('hex'));
  const body = Buffer.from('{"notification_type":"eager"}');
  const now = 1_800_000_000_000, time = '1800000000';
  const signature = createHash('sha1').update(body.toString() + time + secret).digest('hex');
  assert.equal(verifyNotification(body, time, signature, secret, now), true);
  assert.equal(verifyNotification(body, time, signature, secret, now + 8_000_000), false);
  assert.equal(verifyNotification(body, time, '00'.repeat(20), secret, now), false);
});

test('solo acepta manifiestos del entorno Cloudinary esperado', () => {
  assert.equal(validManifestUrl('https://res.cloudinary.com/demo/video/upload/sp_hd/kitsune/demo.m3u8','demo'), true);
  assert.equal(validManifestUrl('https://evil.test/demo/video/upload/demo.m3u8','demo'), false);
  assert.equal(validManifestUrl('https://res.cloudinary.com/other/video/upload/demo.m3u8','demo'), false);
});
