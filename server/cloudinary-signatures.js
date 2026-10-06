import { createHash, timingSafeEqual } from 'node:crypto';

const sha1 = value => createHash('sha1').update(value).digest('hex');
const equalHex = (supplied, expected) => {
  if (!/^[0-9a-f]{40}$/i.test(String(supplied || ''))) return false;
  return timingSafeEqual(Buffer.from(supplied, 'hex'), Buffer.from(expected, 'hex'));
};

export const cloudinarySettings = (env = process.env) => {
  const cloudName = String(env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = String(env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = String(env.CLOUDINARY_API_SECRET || '').trim();
  const baseUrl = String(env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  const ready = /^[a-z0-9_-]+$/i.test(cloudName) && !!apiKey && !!apiSecret && /^https:\/\//.test(baseUrl);
  return { cloudName, apiKey, apiSecret, baseUrl, ready };
};

export function signUpload(params, secret) {
  const input = Object.entries(params).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`).join('&');
  return sha1(input + secret);
}

export function verifyNotification(rawBody, timestamp, signature, secret, now = Date.now()) {
  const time = Number(timestamp);
  if (!Number.isInteger(time) || Math.abs(now / 1000 - time) > 7200) return false;
  return equalHex(signature, sha1(rawBody.toString('utf8') + timestamp + secret));
}

export function validManifestUrl(value, cloudName) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' &&
      url.pathname.startsWith(`/${cloudName}/video/upload/`) && url.pathname.endsWith('.m3u8') &&
      !url.username && !url.password && !url.search && !url.hash;
  } catch { return false; }
}
