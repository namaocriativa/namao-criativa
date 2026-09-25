import {
  formatOfferMoney,
  offerBenefitsText,
  offerPriceLine,
  type OfferPackageInput,
} from '../packages/offer-template';

export type PackageSnapshot = {
  name: string;
  summary: string | null;
  description: string | null;
  benefits: string[];
  price: number | null;
  promoPrice: number | null;
  currency: string;
};

export function snapshotPackage(pkg: OfferPackageInput): PackageSnapshot {
  const benefits = Array.isArray(pkg.benefits)
    ? pkg.benefits.map((item) => String(item).trim()).filter(Boolean)
    : [];
  return {
    name: pkg.name.trim(),
    summary: pkg.summary?.trim() || null,
    description: pkg.description?.trim() || null,
    benefits,
    price: pkg.price ?? null,
    promoPrice: pkg.promoPrice ?? null,
    currency: (pkg.currency || 'BRL').toUpperCase(),
  };
}

export function parseSnapshot(raw: unknown): PackageSnapshot {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const benefits = Array.isArray(value.benefits)
    ? value.benefits.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const price = typeof value.price === 'number' ? value.price : null;
  const promoPrice = typeof value.promoPrice === 'number' ? value.promoPrice : null;
  return {
    name: String(value.name || '').trim() || 'Pacote',
    summary: typeof value.summary === 'string' ? value.summary.trim() || null : null,
    description:
      typeof value.description === 'string' ? value.description.trim() || null : null,
    benefits,
    price,
    promoPrice,
    currency: String(value.currency || 'BRL').toUpperCase(),
  };
}

export function snapshotAmount(snapshot: PackageSnapshot): number | null {
  const promo = snapshot.promoPrice;
  const full = snapshot.price;
  if (promo != null && Number.isFinite(promo) && promo > 0) return promo;
  if (full != null && Number.isFinite(full) && full > 0) return full;
  return null;
}

export function presentSnapshot(snapshot: PackageSnapshot) {
  const input: OfferPackageInput = snapshot;
  return {
    ...snapshot,
    benefitsText: offerBenefitsText(snapshot.benefits),
    priceLabel: formatOfferMoney(snapshot.price, snapshot.currency),
    promoPriceLabel: formatOfferMoney(snapshot.promoPrice, snapshot.currency),
    priceLine: offerPriceLine(input),
  };
}
