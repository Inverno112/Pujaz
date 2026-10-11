import { SignJWT, jwtVerify } from 'jose';
import { AppError } from '../../core/errors.js';

const ALGORITHM = 'HS256';

// Firma y verifica el JWT: solo sub = userId, iat y exp.
export class TokenService {
  private readonly key: Uint8Array;

  constructor(
    secret: string,
    private readonly expiresIn: string,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  sign(userId: string): Promise<string> {
    return new SignJWT()
      .setProtectedHeader({ alg: ALGORITHM })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(this.expiresIn)
      .sign(this.key);
  }

  async verify(token: string): Promise<{ userId: string }> {
    try {
      const { payload } = await jwtVerify(token, this.key, { algorithms: [ALGORITHM] });
      if (!payload.sub) {
        throw new Error('Token sin sub');
      }
      return { userId: payload.sub };
    } catch {
      throw new AppError('UNAUTHENTICATED', 'La sesión no es válida o expiró.');
    }
  }
}
