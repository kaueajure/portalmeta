import { env } from '../config/env.js';
export const errorHandler = (err, req, res, next) => {
    console.error("Internal Error:", err);
    const status = err.status || 500;
    const message = err.message || 'Ocorreu um erro interno no servidor';
    res.status(status).json({
        success: false,
        message,
        errors: !env.IS_PROD ? [err.stack] : []
    });
};
