import pool from '../db/connection.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { sendPasswordRecoveryEmail } from '../utils/mailer.js';
import { sanitizeUser } from '../utils/sanitize.js';
const SECRET = env.JWT_SECRET;
class AuthService {
    async login(email, password) {
        const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
        if (rows.length === 0) {
            throw new Error('E-mail ou senha incorretos');
        }
        const user = rows[0];
        const validPassword = await bcrypt.compare(password, user.senha_hash);
        if (!validPassword) {
            throw new Error('E-mail ou senha incorretos');
        }
        if (Number(user.ativo) !== 1) {
            throw new Error('Sua conta foi desativada. Entre em contato com o administrador.');
        }
        await pool.query('UPDATE usuarios SET ultimo_login = NOW() WHERE id = ?', [user.id]);
        const payload = {
            id: user.id,
            nome: user.nome,
            email: user.email,
            administrador: !!user.administrador,
            desenvolvedor: !!user.desenvolvedor,
            ativo: !!user.ativo
        };
        const sessionToken = jwt.sign(payload, SECRET, { expiresIn: '1d' });
        return { sessionToken, user: sanitizeUser(user) };
    }
    async forgotPassword(email) {
        const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ? AND ativo = 1', [email]);
        if (rows.length === 0) {
            // Return success even if we don't find it to prevent enumeration
            return { message: 'Se o e-mail estiver cadastrado, você receberá um token.' };
        }
        const user = rows[0];
        const token = crypto.randomInt(100000, 1000000).toString(); // 6 digits
        const tokenHash = await bcrypt.hash(token, 10); // S3: nunca armazenar em texto plano
        const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 mins
        await pool.query('UPDATE usuarios SET reset_token = ?, reset_token_expires = ? WHERE id = ?', [tokenHash, expires, user.id]);
        await sendPasswordRecoveryEmail(email, token); // o código em claro vai apenas no e-mail
        return { message: 'Token de recuperação enviado para o seu e-mail.' };
    }
    async resetPassword(email, token, newPassword) {
        // S3: busca por e-mail + token ativo/não expirado, depois compara o hash.
        const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ? AND reset_token IS NOT NULL AND reset_token_expires > NOW()', [email]);
        if (rows.length === 0) {
            throw new Error('Token inválido ou expirado.');
        }
        const user = rows[0];
        const tokenValido = await bcrypt.compare(token, user.reset_token);
        if (!tokenValido) {
            throw new Error('Token inválido ou expirado.');
        }
        const hash = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE usuarios SET senha_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?', [hash, user.id]);
        return { message: 'Senha redefinida com sucesso.' };
    }
}
export default new AuthService();
