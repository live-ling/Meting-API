/** 统一的后端请求层：同源 cookie、JSON 约定、错误归一化。 */

export class ApiError extends Error {
  readonly status: number
  readonly payload: unknown

  constructor(message: string, status: number, payload?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

interface Envelope<T> {
  success?: boolean
  data?: T
  error?: string
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface RequestOptions {
  method?: HttpMethod
  body?: unknown
  signal?: AbortSignal
  headers?: Record<string, string>
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, headers = {} } = options
  const response = await fetch(path, {
    method,
    signal,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const raw = await response.text()
  let payload: unknown = undefined
  if (raw) {
    try {
      payload = JSON.parse(raw)
    } catch {
      payload = raw
    }
  }

  if (!response.ok) {
    const error = typeof payload === 'object' && payload !== null && 'error' in payload
      ? String((payload as { error: unknown }).error)
      : `HTTP ${response.status}`
    throw new ApiError(error, response.status, payload)
  }

  return payload as T
}

/**
 * 后台接口统一返回 { success, data }，这里拆掉外层信封。
 * 业务失败（success:false）也按错误抛出，调用方只处理成功路径。
 */
export async function apiData<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const body = await apiRequest<Envelope<T> | T>(path, options)
  if (body && typeof body === 'object' && 'success' in body) {
    const envelope = body as Envelope<T>
    if (envelope.success === false) {
      throw new ApiError(envelope.error ?? '请求失败', 200, body)
    }
    return envelope.data as T
  }
  return body as T
}
