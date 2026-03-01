export function sanitizeUser(user: Record<string, any> | null) {
  if (!user) return null;
  const { password, refreshTokens, deleted_at, ...rest } = user as any;
  return rest;
}

export default sanitizeUser;
