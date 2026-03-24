/**
 * Bunny.net Stream integration
 * Video: https://docs.bunny.net/stream/embedding
 * Token auth: https://docs.bunny.net/stream/token-authentication
 *
 * Env: BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_TOKEN_SECURITY_KEY
 */

import { createHash } from "crypto";

const LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID || "";
const TOKEN_SECURITY_KEY = process.env.BUNNY_STREAM_TOKEN_SECURITY_KEY || "";

export const BUNNY_EMBED_BASE = "https://iframe.mediadelivery.net/embed";

/**
 * Parse video ID from Bunny URL or return as-is if already an ID
 * Supports: full URL, library_id/video_id, or just video_id (GUID)
 */
export function parseBunnyVideoId(input: string): { libraryId: string; videoId: string } | null {
  if (!input?.trim()) return null;

  const trimmed = input.trim();

  // Full URL: https://iframe.mediadelivery.net/embed/759/eb1c4f77-0cda-46be-b47d-1118ad7c2ffe
  const embedMatch = trimmed.match(/mediadelivery\.net\/embed\/(\d+)\/([a-f0-9-]+)/i);
  if (embedMatch) {
    return { libraryId: embedMatch[1], videoId: embedMatch[2] };
  }

  // Format: library_id/video_id
  const slashMatch = trimmed.match(/^(\d+)\/([a-f0-9-]+)$/);
  if (slashMatch) {
    return { libraryId: slashMatch[1], videoId: slashMatch[2] };
  }

  // Just video ID (GUID) - use env library ID
  const guidMatch = trimmed.match(/^[a-f0-9-]{36}$/i);
  if (guidMatch && LIBRARY_ID) {
    return { libraryId: LIBRARY_ID, videoId: trimmed };
  }

  return null;
}

/**
 * Generate signed embed URL for Bunny Stream (token authentication)
 * Token = SHA256_HEX(token_security_key + video_id + expiration)
 */
export function getSignedEmbedUrl(
  videoUrlOrId: string,
  expiresInSeconds = 3600
): string | null {
  const parsed = parseBunnyVideoId(videoUrlOrId);
  if (!parsed) return null;

  const { libraryId, videoId } = parsed;
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;

  if (!TOKEN_SECURITY_KEY) {
    // No token key: return unsigned URL (public videos only)
    return `${BUNNY_EMBED_BASE}/${libraryId}/${videoId}`;
  }

  const hashInput = TOKEN_SECURITY_KEY + videoId + expires;
  const token = createHash("sha256").update(hashInput).digest("hex");

  return `${BUNNY_EMBED_BASE}/${libraryId}/${videoId}?token=${token}&expires=${expires}`;
}

/**
 * Check if Bunny config is available
 */
export function isBunnyConfigured(): boolean {
  return Boolean(LIBRARY_ID);
}
