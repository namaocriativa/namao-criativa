const IPV4 =
  /(?:^|\.)((?:25[0-5]|2[0-4]\d|1?\d?\d)\.(?:25[0-5]|2[0-4]\d|1?\d?\d)\.(?:25[0-5]|2[0-4]\d|1?\d?\d)\.(?:25[0-5]|2[0-4]\d|1?\d?\d))\.sslip\.io$/i;

/** Public IPv4 encoded in Coolify’s `*.<ip>.sslip.io` wildcard FQDN. */
export function sslipPublicIpv4(fqdn: string | undefined | null): string | null {
  const host = String(fqdn || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .trim()
    .toLowerCase();
  if (!host) return null;
  const match = host.match(IPV4);
  return match?.[1] ?? null;
}

export function resolveCoolifyPublicIp(opts: {
  envIp?: string | null;
  appFqdn?: string | null;
}): string {
  const fromEnv = opts.envIp?.trim() || '';
  if (fromEnv) return fromEnv;
  return sslipPublicIpv4(opts.appFqdn) || '';
}
