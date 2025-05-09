import jwt, { SignOptions, JwtPayload } from "jsonwebtoken";
import config from "../config";

const { JWT_SECRET } = config;

class Token {
  generateToken(
    payload: string | object | Buffer,
    expiryTime: string | number
  ): string {
    const options: SignOptions = {
      expiresIn: expiryTime as SignOptions["expiresIn"],
    };
    return jwt.sign(payload, JWT_SECRET as string, options);
  }

  verifyToken(token: string): string | JwtPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET as string);
    } catch (err) {
      return null;
    }
  }
}

export default new Token();
