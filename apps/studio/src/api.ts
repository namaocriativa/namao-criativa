const LOGIN_PATH = "/login";

function onLoginPage(): boolean {
  const path = window.location.pathname;
  return path.endsWith("/login.html") || path === "/login";
}

export async function api(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const res = await fetch(input, { ...init, credentials: "include" });
  if (res.status === 401 && !onLoginPage()) {
    window.location.replace(LOGIN_PATH);
  }
  return res;
}
