import { AuthUser } from './auth.decorators';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
    user?: AuthUser;
  }
}
