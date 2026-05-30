import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models';

/** Thin HTTP wrapper that unwraps the { success, data } envelope. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  get<T>(path: string, params?: Record<string, string | number | boolean>): Observable<T> {
    return this.http
      .get<ApiResponse<T>>(`${this.base}${path}`, { params: this.toParams(params) })
      .pipe(map((res) => this.unwrap(res)));
  }

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.http
      .post<ApiResponse<T>>(`${this.base}${path}`, body ?? {})
      .pipe(map((res) => this.unwrap(res)));
  }

  patch<T>(path: string, body?: unknown): Observable<T> {
    return this.http
      .patch<ApiResponse<T>>(`${this.base}${path}`, body ?? {})
      .pipe(map((res) => this.unwrap(res)));
  }

  put<T>(path: string, body?: unknown): Observable<T> {
    return this.http
      .put<ApiResponse<T>>(`${this.base}${path}`, body ?? {})
      .pipe(map((res) => this.unwrap(res)));
  }

  delete<T>(path: string): Observable<T> {
    return this.http
      .delete<ApiResponse<T>>(`${this.base}${path}`)
      .pipe(map((res) => this.unwrap(res)));
  }

  /** Raw response (no envelope unwrap) — for CSV / file downloads. Interceptors still apply. */
  getText(path: string): Observable<string> {
    return this.http.get(`${this.base}${path}`, { responseType: 'text' });
  }

  private unwrap<T>(res: ApiResponse<T>): T {
    if (res.success) return res.data;
    throw new Error(res.error.message);
  }

  private toParams(params?: Record<string, string | number | boolean>): HttpParams {
    let p = new HttpParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) p = p.set(k, String(v));
    }
    return p;
  }
}
