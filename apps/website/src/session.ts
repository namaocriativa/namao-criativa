export async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(path, { ...init, headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const raw = (data as { message?: string | string[] }).message;
    throw new Error(
      Array.isArray(raw) ? raw[0] : raw || `Erro ${res.status}`,
    );
  }
  return data;
}

export async function probeLoggedIn(): Promise<boolean> {
  try {
    const res = await fetch('/auth/me', { credentials: 'include' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function clearSession() {
  await fetch('/auth/logout', {
    method: 'POST',
    credentials: 'include',
  }).catch(() => undefined);
}
