export type StudioUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

let currentUser: StudioUser | null = null;

export function getStudioUser(): StudioUser | null {
  return currentUser;
}

export function isStudioAdmin(): boolean {
  return currentUser?.role === "ADMIN";
}

export async function requireStudioSession(): Promise<StudioUser> {
  const res = await fetch("/auth/me", { credentials: "include" });
  if (!res.ok) {
    window.location.replace("/login");
    throw new Error("unauthenticated");
  }
  const data = (await res.json()) as { user?: StudioUser };
  const user = data.user;
  if (!user || (user.role !== "ADMIN" && user.role !== "OPERATOR")) {
    await fetch("/auth/studio/logout", {
      method: "POST",
      credentials: "include",
    });
    window.location.replace("/login");
    throw new Error("forbidden");
  }
  currentUser = user;
  return user;
}

export async function logoutStudio(): Promise<void> {
  await fetch("/auth/studio/logout", {
    method: "POST",
    credentials: "include",
  });
  currentUser = null;
  window.location.replace("/login");
}
