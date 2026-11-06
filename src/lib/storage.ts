/**
 * Blox Fruit Services - Discord Proof & Storage Configuration
 *
 * NOTE: Website-based media uploads and S3 / Neon Object Storage have been disabled.
 * All service completion proofs, screenshots, videos, and live gameplay screen-sharing
 * are now coordinated and shared manually through Discord.
 */

export const DEFAULT_DISCORD_INVITE_URL = 'https://discord.gg/placeholder-blox-fruit-services';

export const DISCORD_INVITE_URL =
  process.env.VITE_DISCORD_INVITE_URL || DEFAULT_DISCORD_INVITE_URL;

export const isUploadDisabled = true;

export function getDiscordInviteUrl(): string {
  return DISCORD_INVITE_URL;
}
