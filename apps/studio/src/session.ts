export type StudioUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId?: string | null;
  impersonatingTenantId?: string | null;
  tenantName?: string | null;
  canAccessImages?: boolean;
  canAccessVideos?: boolean;
};

let currentUser: StudioUser | null = null;

export function getStudioUser(): StudioUser | null {
  return currentUser;
}

export function isStudioRoot(): boolean {
  return currentUser?.role === "ROOT";
}

export function isStudioAdmin(): boolean {
  if (!currentUser) return false;
  return (
    currentUser.role === "ADMIN" ||
    (currentUser.role === "ROOT" && Boolean(currentUser.tenantId))
  );
}

export function canAccessImages(
  user: StudioUser | null | undefined = currentUser,
): boolean {
  if (!user) return false;
  const tenantAdmin =
    user.role === "ADMIN" || (user.role === "ROOT" && Boolean(user.tenantId));
  return tenantAdmin || user.canAccessImages === true;
}

export function canAccessVideos(
  user: StudioUser | null | undefined = currentUser,
): boolean {
  if (!user) return false;
  const tenantAdmin =
    user.role === "ADMIN" || (user.role === "ROOT" && Boolean(user.tenantId));
  return tenantAdmin || user.canAccessVideos === true;
}

export function canAccessCreative(
  user: StudioUser | null | undefined = currentUser,
): boolean {
  return canAccessImages(user) || canAccessVideos(user);
}

export async function requireStudioSession(): Promise<StudioUser> {
  const res = await fetch("/auth/me", { credentials: "include" });
  if (!res.ok) {
    window.location.replace("/login");
    throw new Error("unauthenticated");
  }
  const data = (await res.json()) as { user?: StudioUser };
  const user = data.user;
  if (
    !user ||
    (user.role !== "ADMIN" && user.role !== "OPERATOR" && user.role !== "ROOT")
  ) {
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

export function setStudioUser(user: StudioUser) {
  currentUser = user;
}
