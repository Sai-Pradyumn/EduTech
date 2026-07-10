import { Role } from '../enums';

/** Shape of the JWT payload and the request-attached user. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  /** Token version — bumping the user's version revokes every outstanding refresh token
   *  ("log out all devices", forced revocation on compromise). Absent on legacy tokens. */
  tv?: number;
}

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

/** Standard success/error response envelope. */
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
