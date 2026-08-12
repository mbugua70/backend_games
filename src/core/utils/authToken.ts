import jwt from "jsonwebtoken";

export const signToken = <T extends object>(
  payload: T,
  secret: string,
  expiresIn: string
): string => {
  return jwt.sign(payload, secret, {
    expiresIn,
  } as jwt.SignOptions);
};

export const verifyToken = <T>(token: string, secret: string): T => {
  return jwt.verify(token, secret) as T;
};
