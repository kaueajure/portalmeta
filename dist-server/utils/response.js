export const sendSuccess = (res, data, message = 'Operação realizada com sucesso', status = 200) => {
    return res.status(status).json({
        success: true,
        message,
        data
    });
};
export const sendError = (res, message, status = 500, errors = []) => {
    return res.status(status).json({
        success: false,
        message,
        errors
    });
};
