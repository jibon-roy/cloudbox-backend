import { redis } from "./redisConnection";

const KEY_PREFIX = "otp:";

export async function saveOtp(
  email: string,
  code: string,
  ttlMs = 10 * 60 * 1000,
) {
  const key = `${KEY_PREFIX}${email.toLowerCase()}`;
  const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
  await redis.set(key, code, "EX", ttlSec);
}

export async function verifyOtp(email: string, code: string) {
  const key = `${KEY_PREFIX}${email.toLowerCase()}`;
  const stored = await redis.get(key);
  if (!stored) return false;
  if (stored === code) {
    await redis.del(key);
    return true;
  }
  return false;
}

export async function clearOtp(email: string) {
  const key = `${KEY_PREFIX}${email.toLowerCase()}`;
  await redis.del(key);
}

export default { saveOtp, verifyOtp, clearOtp };
