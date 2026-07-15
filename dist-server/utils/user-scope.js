export function isDeveloperUser(user) {
    if (!user)
        return false;
    return user.desenvolvedor === 1 || user.desenvolvedor === true || user.perfil === 'desenvolvedor';
}
