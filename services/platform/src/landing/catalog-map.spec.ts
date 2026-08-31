import { getCatalogEntry, isDeterministicType } from './catalog-map';

describe('catalog-map', () => {
  it('marca services/header/gallery/footer/testimonials como deterministic', () => {
    expect(isDeterministicType('services')).toBe(true);
    expect(isDeterministicType('header')).toBe(true);
    expect(isDeterministicType('gallery')).toBe(true);
    expect(isDeterministicType('footer')).toBe(true);
    expect(isDeterministicType('testimonials')).toBe(true);
  });

  it('marca hero/about/contact/custom como copy', () => {
    expect(isDeterministicType('hero')).toBe(false);
    expect(isDeterministicType('about')).toBe(false);
    expect(isDeterministicType('contact')).toBe(false);
    expect(isDeterministicType('custom')).toBe(false);
  });

  it('services exige o campo services', () => {
    expect(getCatalogEntry('services').requiredBriefFields).toContain('services');
  });
});
