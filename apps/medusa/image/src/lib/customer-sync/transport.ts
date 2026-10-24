export class RemoteError extends Error {
  constructor(public system: string, public status: number, public retryAfter = 0) { super(`${system} request failed (${status})`) }
}
export async function json<T>(system: string, url: string, init: RequestInit): Promise<T> {
  let response: Response
  try { response = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(15000) }) }
  catch { throw new RemoteError(system, 0) }
  if (!response.ok) throw new RemoteError(system, response.status, Math.min(86400, Number(response.headers.get("retry-after")) || 0) * 1000)
  try { return await response.json() as T } catch { throw new RemoteError(system, 502) }
}
