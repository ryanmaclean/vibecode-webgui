// vibecode-webgui/src/lib/db/health-checks.ts

import { prisma } from "@/lib/prisma/client";
import weaviateClient from "@/lib/weaviate/client";

/**
 * Perform a lightweight health check against the PostgreSQL instance.
 *
 * The function attempts to run a simple `SELECT 1` query via Prisma. If it
 * succeeds, PostgreSQL is considered healthy; otherwise the error is logged and false is returned.
 */
export async function checkPostgresHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    console.error("PostgreSQL health check failed:", err);
    return false;
  }
}

/**
 * Perform a lightweight health check against the Weaviate instance.
 *
 * The function queries the `/v1/health/live` endpoint. A 200 status code
 * indicates that Weaviate is healthy; any other response or exception
 * results in a failed health check.
 */
export async function checkWeaviateHealth(): Promise<boolean> {
  try {
    const resp = await weaviateClient.healthCheck();
    // The client returns an object with `healthy` boolean property or just boolean
    return typeof resp === 'boolean' ? resp : !!resp?.healthy;
  } catch (err) {
    console.error("Weaviate health check failed:", err);
    return false;
  }
}
