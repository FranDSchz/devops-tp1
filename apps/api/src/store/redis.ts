import { Redis } from "ioredis";

let client: InstanceType<typeof Redis> | null = null;

export function getRedis(): InstanceType<typeof Redis> {
  if (!client) {
    client = new Redis({
      host: process.env.REDIS_HOST ?? "localhost",
      port: Number(process.env.REDIS_PORT ?? 6379),
    });
  }
  return client;
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
