export function parseFromAddress(from: string): string {
  const angled = from.match(/<([^>]+)>/);
  return (angled?.[1] || from).trim();
}

export function replyToForFrom(from: string): string {
  const address = parseFromAddress(from);
  const at = address.lastIndexOf('@');
  if (at <= 0) return 'contato@namaocriativa.com.br';
  const local = address.slice(0, at).toLowerCase();
  const domain = address.slice(at + 1);
  if (local === 'noreply' || local === 'no-reply') {
    return `contato@${domain}`;
  }
  return address;
}

export function transactionalMailFields(from: string): {
  replyTo: string;
  headers: Record<string, string>;
  tags: Array<{ name: string; value: string }>;
} {
  const replyTo = replyToForFrom(from);
  return {
    replyTo,
    headers: {
      'List-Unsubscribe': `<mailto:${replyTo}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    tags: [{ name: 'category', value: 'transactional' }],
  };
}
