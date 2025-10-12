import axios from "axios";
import { logger } from '@/lib/logger';
const WEAVIATE_URL = process.env.WEAVIATE_URL || "http://localhost:8080";

/**
 * Simple wrapper around the Weaviate health endpoint.
 */
export default {
  async healthCheck() {
    try {
      const resp = await axios.get(`${WEAVIATE_URL}/v1/health/live`);
      // The API returns { healthy: true } when alive
      return resp.data?.healthy ?? false;
    } catch (e) {
      logger.error("Weaviate health check failed", e);
      return false;
    }
  },
};
