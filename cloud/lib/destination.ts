import type { CoolifyClient } from './coolify-client.js';

type DestinationRef = {
  uuid?: string;
  name?: string;
  network?: string;
  server?: { uuid?: string; name?: string };
};

type DatabaseWithDestination = {
  uuid?: string;
  name?: string;
  destination?: DestinationRef;
};

export async function resolveDestinationUuid(
  client: CoolifyClient,
  serverUuid: string,
  fallback?: string,
): Promise<string | undefined> {
  const fromEnv = process.env.COOLIFY_DESTINATION_UUID?.trim();
  if (fromEnv) return fromEnv;
  if (fallback?.trim()) return fallback.trim();

  const listed = await client.get<DatabaseWithDestination[]>('/databases');
  const dbs = Array.isArray(listed) ? listed : [];

  const fromList = pickDestination(dbs, serverUuid);
  if (fromList) return fromList;

  for (const db of dbs) {
    if (!db.uuid) continue;
    const detail = await client.get<DatabaseWithDestination>(
      `/databases/${db.uuid}`,
    );
    const uuid = pickDestination([detail], serverUuid);
    if (uuid) return uuid;
  }

  return undefined;
}

function pickDestination(
  dbs: DatabaseWithDestination[],
  serverUuid: string,
): string | undefined {
  const sameServer = dbs.find(
    (db) =>
      db.destination?.uuid &&
      (!db.destination.server?.uuid ||
        db.destination.server.uuid === serverUuid),
  );
  return sameServer?.destination?.uuid;
}
