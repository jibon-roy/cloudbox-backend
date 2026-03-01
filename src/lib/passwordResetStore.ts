import { redis } from "./redisConnection";

const KEY_PREFIX = "pwreset:";

export async function saveResetToken(
  email: string,
  token: string,
  ttlMs = 60 * 60 * 1000,
) {
  const key = `${KEY_PREFIX}${token}`;
  const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
  // store email by token
  await redis.set(key, email.toLowerCase(), "EX", ttlSec);
}

// Verify token and consume it (delete on success)
export async function consumeResetToken(token: string) {
  const key = `${KEY_PREFIX}${token}`;
  // Try GETDEL for atomicity if available
  // ioredis supports GETDEL on recent Redis versions; fall back to GET + DEL
  if (typeof (redis as any).getdel === "function") {
    const email = await (redis as any).getdel(key);
    return email || null;
  }

  const email = await redis.get(key);
  if (!email) return null;
  await redis.del(key);
  return email;
}

export async function peekResetToken(token: string) {
  const key = `${KEY_PREFIX}${token}`;
  return await redis.get(key);
}

export default { saveResetToken, consumeResetToken, peekResetToken };
