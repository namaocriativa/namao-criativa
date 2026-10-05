import type { BrandIdentity } from "./brand-identity-modal";
import { hasUsefulBrandIdentity } from "./brand-identity-modal";

export type ProduceBrandFlags = {
  useBrandIdentity: boolean;
  useBrandLogo: boolean;
  logoAppearance: string;
};

export function defaultProduceBrandFlags(
  identity: BrandIdentity | null | undefined,
): ProduceBrandFlags {
  return {
    useBrandIdentity: hasUsefulBrandIdentity(identity),
    useBrandLogo: false,
    logoAppearance: "",
  };
}

export function produceBrandPayload(flags: ProduceBrandFlags): {
  useBrandIdentity?: boolean;
  useBrandLogo?: boolean;
  logoAppearance?: string;
} {
  const payload: {
    useBrandIdentity?: boolean;
    useBrandLogo?: boolean;
    logoAppearance?: string;
  } = {};
  if (flags.useBrandIdentity) payload.useBrandIdentity = true;
  if (flags.useBrandLogo) {
    payload.useBrandLogo = true;
    const appearance = flags.logoAppearance.trim();
    if (appearance) payload.logoAppearance = appearance;
  }
  return payload;
}
