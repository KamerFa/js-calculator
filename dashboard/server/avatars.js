// Server-side avatar utilities
// Avatars are stored as "avatar:<index>" in avatar_url column
// The frontend resolves these to actual SVG data URIs

const AVATAR_COUNT = 21;

export function getRandomAvatarUrl() {
  const index = Math.floor(Math.random() * AVATAR_COUNT);
  return `avatar:${index}`;
}

export { AVATAR_COUNT };
