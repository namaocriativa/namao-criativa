import { CoolifyError, type CoolifyClient } from './coolify-client.js';

type NamedResource = { uuid?: string; name?: string };

export async function findDatabaseByName(
  client: CoolifyClient,
  name: string,
): Promise<string | undefined> {
  const listed = await client.get<NamedResource[]>('/databases');
  const dbs = Array.isArray(listed) ? listed : [];
  return dbs.find((db) => db.name === name)?.uuid;
}

export async function databaseExists(
  client: CoolifyClient,
  uuid: string,
): Promise<boolean> {
  try {
    await client.get(`/databases/${uuid}`);
    return true;
  } catch (err) {
    if (err instanceof CoolifyError && err.status === 404) return false;
    throw err;
  }
}

export async function findApplicationByName(
  client: CoolifyClient,
  name: string,
): Promise<string | undefined> {
  const listed = await client.get<NamedResource[]>('/applications');
  const apps = Array.isArray(listed) ? listed : [];
  return apps.find((app) => app.name === name)?.uuid;
}

export async function applicationExists(
  client: CoolifyClient,
  uuid: string,
): Promise<boolean> {
  try {
    await client.get(`/applications/${uuid}`);
    return true;
  } catch (err) {
    if (err instanceof CoolifyError && err.status === 404) return false;
    throw err;
  }
}
