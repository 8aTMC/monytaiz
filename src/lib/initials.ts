/**
 * Get initials from a display name or username
 * Returns first letter of first two words, or first two letters of single word
 */
export const getInitials = (displayName?: string | null, username?: string | null): string => {
  const name = displayName || username || 'User';
  const words = name.trim().split(/\s+/);
  
  if (words.length >= 2) {
    // First letter of first two words
    return (words[0][0] + words[1][0]).toUpperCase();
  } else {
    // First two letters of single word
    return name.slice(0, 2).toUpperCase();
  }
};