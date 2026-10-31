import RedisClient from "ioredis";

const LIMIT = 100;
const WINDOW_MS = 10_000;

type LimitResult = { success: boolean; remaining: number };

const memoryBuckets = new Map<string, number[]>();

export function consumeMemoryWindow(
  key: string,
  now = Date.now(),
  limit = LIMIT,
  windowMs = WINDOW_MS,
): LimitResult {
  const recent = (memoryBuckets.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) {
    memoryBuckets.set(key, recent);
    return { success: false, remaining: 0 };
  }
  recent.push(now);
  memoryBuckets.set(key, recent);
  return { success: true, remaining: limit - recent.length };
}

let redis: RedisClient | null = null;

function valkey() {
  if (!process.env.REDIS_URL) return null;
  if (redis) return redis;
  redis = new RedisClient(process.env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 1000,
    commandTimeout: 1000,
  });
  // 'error' fires alongside the rejected command; the route returns 503
  redis.on("error", () => {});
  return redis;
}

async function ready(client: RedisClient) {
  if (client.status === "ready") return;
  if (client.status === "wait" || client.status === "end") {
    await client.connect().catch(() => undefined);
  }
  if (client.status === "ready") return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off("ready", onReady);
      reject(new Error("Rate limiter unavailable"));
    }, 1000);
    function onReady() {
      clearTimeout(timer);
      resolve();
    }
    client.once("ready", onReady);
  });
}

const SLIDING_WINDOW = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local max = tonumber(ARGV[3])
local member = ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count >= max then
  return {0, count}
end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)
return {1, count + 1}
`;

async function consumeValkey(key: string): Promise<LimitResult> {
  const client = valkey();
  if (!client) return consumeMemoryWindow(key);
  await ready(client);
  const now = Date.now();
  const raw = (await client.eval(
    SLIDING_WINDOW,
    1,
    `csp-ingest:${key}`,
    String(now),
    String(WINDOW_MS),
    String(LIMIT),
    `${now}:${Math.random()}`,
  )) as [number, number];
  const used = Number(raw[1]);
  return { success: Number(raw[0]) === 1, remaining: Math.max(LIMIT - used, 0) };
}

export async function limitIngestion(identifier: string): Promise<LimitResult> {
  if (process.env.REDIS_URL) return consumeValkey(identifier);
  // shortcut: one process only, set REDIS_URL before a second instance
  return consumeMemoryWindow(identifier);
}
