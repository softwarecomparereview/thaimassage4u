type CacheEnv = { CACHE?: KVNamespace };
type MediaEnv = { MEDIA?: R2Bucket };

const CACHE_GEN = "v2:";

export async function cacheGet(env: Env, key: string): Promise<string | null> {
  const cache = (env as CacheEnv).CACHE;
  if (!cache) return null;
  return cache.get(CACHE_GEN + key);
}

export async function cachePut(env: Env, key: string, value: string, ttl: number): Promise<void> {
  const cache = (env as CacheEnv).CACHE;
  if (!cache) return;
  await cache.put(CACHE_GEN + key, value, { expirationTtl: ttl });
}

export async function cacheDelete(env: Env, ...keys: string[]): Promise<void> {
  const cache = (env as CacheEnv).CACHE;
  if (!cache) return;
  await Promise.all(keys.map((key) => cache.delete(CACHE_GEN + key)));
}

export async function mediaGet(env: Env, key: string): Promise<R2ObjectBody | null> {
  const media = (env as MediaEnv).MEDIA;
  if (!media) return null;
  return media.get(key);
}

export async function mediaPut(
  env: Env,
  key: string,
  value: string | ArrayBuffer | Uint8Array | ReadableStream,
  options?: R2PutOptions
): Promise<void> {
  const media = (env as MediaEnv).MEDIA;
  if (!media) return;
  await media.put(key, value, options);
}
