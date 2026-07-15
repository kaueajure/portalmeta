import { Response } from 'express';

export const sendSuccess = (res: Response, data: any, message: string = 'Operação realizada com sucesso', status: number = 200) => {
  return res.status(status).json({
    success: true,
    message,
    data
  });
};

export const sendError = (res: Response, message: string, status: number = 500, errors: any[] = []) => {
  return res.status(status).json({
    success: false,
    message,
    errors
  });
};
