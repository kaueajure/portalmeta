export interface UserScopeLike {
  desenvolvedor?: boolean | number | null;
  perfil?: string | null;
}

export function isDeveloperUser(user?: UserScopeLike | null): boolean {
  if (!user) return false;

  return user.desenvolvedor === 1 || user.desenvolvedor === true || user.perfil === 'desenvolvedor';
}
