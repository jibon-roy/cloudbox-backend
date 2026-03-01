import Redis, { RedisOptions } from "ioredis";

const redisOptions: RedisOptions = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
  //  🔹 রিট্রাই স্ট্রাটেজি: প্রথম ৫ বার কানেকশন ব্যর্থ হলে তাৎক্ষণিক পুনরায় চেষ্টা করবে,
  // 🔹 অন্যথায় times * 100 মিলিসেকেন্ড পর আবার চেষ্টা করবে, তবে সর্বোচ্চ 3000ms (৩ সেকেন্ড) এর বেশি
  retryStrategy: (times: number) => {
    // Returning null disables reconnect; use 0 for immediate retry.
    if (times <= 5) return 0;
    return Math.min(times * 100, 3000);
  },
  connectTimeout: 10000,
  keepAlive: 30000, //🔹 TCP কানেকশন অ্যাক্টিভ রাখার জন্য ৩০ সেকেন্ড পর পর সিগন্যাল পাঠাবে।
  maxRetriesPerRequest: null, //এর মানে হচ্ছে প্রতি রিকোয়েস্টে যতবার খুশি রিট্রাই করতে পারবে, কোনো সীমা দেওয়া নেই।
  // Prevent unbounded memory growth if Redis is down.
  enableOfflineQueue: false,
};

export const redis = new Redis(redisOptions);

// Redis কানেকশন ইভেন্ট হ্যান্ডেলিং
redis.on("connect", () => {
  console.log("✅ Redis connected");
});

redis.on("error", (err) => {
  console.log("❌ Redis error:", err?.message ?? err);
});

redis.on("reconnecting", () => {
  console.log("⏳ Redis reconnecting...");
});

// Helper to create a dedicated Redis client (useful for pub/sub subscribers)
export const createRedisClient = (overrides?: Partial<RedisOptions>) => {
  return new Redis({ ...redisOptions, ...(overrides || {}) });
};

export async function ensureRedisConnected(timeoutMs = 5000) {
  const start = Date.now();
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  while (Date.now() - start < timeoutMs) {
    try {
      const pong = await redis.ping();
      if (pong === "PONG") return true;
    } catch (err) {
      // ignore and retry
    }
    // small delay between attempts
    // eslint-disable-next-line no-await-in-loop
    await sleep(250);
  }
  throw new Error(`Redis did not become ready within ${timeoutMs}ms`);
}

export default redis;
