import axios, { AxiosRequestConfig } from 'axios';

type Primitive = string | number | boolean;
export type QueryValue = Primitive | null | undefined;
export type QueryInput = QueryValue | QueryValue[];
export type QueryParams = Record<string, QueryInput>;

function appendQuery(search: URLSearchParams, key: string, value: QueryInput) {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item === null || item === undefined || item === '') continue;
      search.append(key, String(item));
    }
    return;
  }
  if (value === null || value === undefined || value === '') return;
  search.append(key, String(value));
}

export function withQuery(path: string, query?: QueryParams): string {
  if (!query || Object.keys(query).length === 0) return path;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    appendQuery(search, key, value);
  }
  const qs = search.toString();
  if (!qs) return path;
  return path.includes('?') ? `${path}&${qs}` : `${path}?${qs}`;
}

function isFormData(body: unknown): body is FormData {
  return body instanceof FormData;
}

function getAxiosConfig(body?: unknown, config?: AxiosRequestConfig): AxiosRequestConfig {
  const finalConfig = { ...config };
  if (isFormData(body)) {
    finalConfig.headers = {
      ...(finalConfig.headers ?? {}),
      // Bổ sung cho interceptor AxiosConfig (axios merge default json trước interceptor)
      'Content-Type': false as unknown as string,
    };
  }
  return finalConfig;
}

export async function get<T>(path: string, query?: QueryParams, config?: AxiosRequestConfig): Promise<T> {
  const res = await axios.get<T>(withQuery(path, query), config);
  return res.data;
}

export async function post<T>(path: string, body?: unknown, query?: QueryParams, config?: AxiosRequestConfig): Promise<T> {
  const finalConfig = { ...config };
  // Let Axios determine multipart boundaries automatically for FormData
  if (body instanceof FormData) {
    if (finalConfig.headers) {
      const headers = { ...finalConfig.headers };
      if (typeof headers['Content-Type'] !== 'string' && typeof headers['content-type'] !== 'string') {
        delete headers['Content-Type'];
        delete headers['content-type'];
      }
      finalConfig.headers = headers;
    }
  }
  const res = await axios.post<T>(withQuery(path, query), body, finalConfig);
  return res.data;
}

export async function put<T>(path: string, body?: unknown, query?: QueryParams, config?: AxiosRequestConfig): Promise<T> {
  const res = await axios.put<T>(withQuery(path, query), body, config);
  return res.data;
}

export async function patch<T>(path: string, body?: unknown, query?: QueryParams, config?: AxiosRequestConfig): Promise<T> {
  const res = await axios.patch<T>(withQuery(path, query), body, config);
  return res.data;
}

export async function del<T>(path: string, query?: QueryParams, config?: AxiosRequestConfig): Promise<T> {
  const res = await axios.delete<T>(withQuery(path, query), config);
  return res.data;
}
