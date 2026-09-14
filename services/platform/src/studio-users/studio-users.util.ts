export function nameFromEmail(email: string): string {
  const local = email.split('@')[0]?.trim() || '';
  const words = local
    .replace(/[._+\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!words) return 'Operador';
  return words
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .slice(0, 120);
}
