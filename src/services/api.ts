// Placeholder for future backend integration
export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string }

export async function get<T>(_path: string): Promise<ApiResponse<T>> {
  // Implement with fetch once backend is available
  return { ok: false, error: 'Not implemented' }
}

export async function post<T>(_path: string, _body: unknown): Promise<ApiResponse<T>> {
  return { ok: false, error: 'Not implemented' }
}

