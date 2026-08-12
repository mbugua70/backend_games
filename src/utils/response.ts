import { Response } from "express";

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200
): void => {
  res.status(statusCode).json({
    success: true,
    ...(message && { message }),
    data,
  });
};

export const sendError = (
  res: Response,
  message: string,
  statusCode = 500
): void => {
  res.status(statusCode).json({
    success: false,
    message,
  });
};
