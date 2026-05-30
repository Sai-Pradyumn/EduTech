import { Role } from '../enums';

/** Shape of the JWT payload and the request-attached user. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
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
