export type EntityKind = "lead" | "customer";

export function profileApi(
  kind: EntityKind,
  id: string,
  suffix = "",
): string {
  const base = kind === "customer" ? "/customers" : "/leads";
  return `${base}/${encodeURIComponent(id)}${suffix}`;
}

export function entityKindOf(
  value: { _entityKind?: EntityKind } | null | undefined,
): EntityKind {
  return value?._entityKind === "customer" ? "customer" : "lead";
}
