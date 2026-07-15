export const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// S4: política de senha centralizada (fonte única).
// Mínimo de 8 caracteres; máximo de 72 porque o bcrypt trunca em 72 bytes,
// evitando o comportamento silencioso de ignorar o excedente.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
export const PASSWORD_RULE_MESSAGE = `A senha deve ter entre ${PASSWORD_MIN_LENGTH} e ${PASSWORD_MAX_LENGTH} caracteres.`;

export const isValidPassword = (password: unknown): password is string => {
  return typeof password === 'string'
    && password.length >= PASSWORD_MIN_LENGTH
    && password.length <= PASSWORD_MAX_LENGTH;
};

export const isNumeric = (val: any) => {
  return !isNaN(parseFloat(val)) && isFinite(val);
};

export const isValidId = (id: any) => {
  const n = Number(id);
  return Number.isInteger(n) && n > 0;
};

export const isValidHexColor = (color: string) => {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
};
