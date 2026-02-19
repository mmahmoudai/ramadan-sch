import axios from "axios";

interface TimezoneInfo {
  timezone: string;
  country: string;
  city: string;
  ip: string;
}

const IP_TIMEZONE_CACHE = new Map<string, TimezoneInfo>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Detect timezone from IP address using ip-api.com
 * Returns Egypt timezone as fallback if detection fails
 */
export async function detectTimezoneFromIp(ip?: string): Promise<TimezoneInfo> {
  const clientIp = ip || "unknown";
  
  // Check cache first
  const cached = IP_TIMEZONE_CACHE.get(clientIp);
  if (cached && Date.now() - (cached as any).cachedAt < CACHE_TTL) {
    return cached;
  }

  try {
    // Use ip-api.com to get timezone information
    const response = await axios.get(`http://ip-api.com/json/${clientIp === "unknown" ? "" : clientIp}?fields=status,message,timezone,country,city,query`, {
      timeout: 5000,
    });

    if (response.data.status === "success" && response.data.timezone) {
      const result: TimezoneInfo = {
        timezone: response.data.timezone,
        country: response.data.country,
        city: response.data.city,
        ip: response.data.query,
      };
      
      // Cache the result
      (result as any).cachedAt = Date.now();
      IP_TIMEZONE_CACHE.set(clientIp, result);
      
      return result;
    }
  } catch (error) {
    console.error("[TIMEZONE] Failed to detect timezone from IP:", error);
  }

  // Fallback to Egypt timezone
  const fallback: TimezoneInfo = {
    timezone: "Africa/Cairo",
    country: "Egypt",
    city: "Cairo",
    ip: clientIp,
  };
  
  (fallback as any).cachedAt = Date.now();
  IP_TIMEZONE_CACHE.set(clientIp, fallback);
  
  return fallback;
}

/**
 * Get client IP from request
 */
export function getClientIp(req: any): string {
  return req.ip || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         (req.connection?.socket ? req.connection.socket.remoteAddress : null) ||
         req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.headers['x-client-ip'] ||
         req.headers['cf-connecting-ip'] || // Cloudflare
         "unknown";
}
