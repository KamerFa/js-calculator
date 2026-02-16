import { getAvatar } from './avatars';

/**
 * Resolve avatar URL — handles both "avatar:N" references and regular URLs
 */
export function resolveAvatarUrl(url) {
  if (!url) return null;
  if (url.startsWith('avatar:')) {
    const index = parseInt(url.split(':')[1], 10);
    if (!isNaN(index)) return getAvatar(index);
    return null;
  }
  return url;
}
