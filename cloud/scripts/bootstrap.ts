import {
  createClientFromEnv,
  type CoolifyClient,
} from '../lib/coolify-client.js';
import { loadEnv, loadStackConfig, log } from '../lib/config.js';
import { loadState, saveState, type CloudState } from '../lib/state.js';

type Server = { uuid?: string; name?: string; ip?: string };
type Project = {
  uuid?: string;
  name?: string;
  environments?: Array<{ uuid?: string; name?: string }>;
};
type ProjectCreated = { uuid?: string };

async function resolveServer(
  client: CoolifyClient,
  serverName: string,
): Promise<string> {
  const servers = await client.get<Server[]>('/servers');
  const list = Array.isArray(servers) ? servers : [];
  if (!list.length) {
    throw new Error('No Coolify servers found for this token');
  }

  const match =
    list.find((s) => s.name === serverName) ||
    list.find((s) => (s.name || '').toLowerCase() === serverName.toLowerCase()) ||
    list.find((s) => s.name === 'localhost') ||
    list[0];

  if (!match?.uuid) {
    throw new Error(
      `Server "${serverName}" not found. Available: ${list
        .map((s) => s.name)
        .join(', ')}`,
    );
  }
  log('bootstrap', `server=${match.name} uuid=${match.uuid}`);
  return match.uuid;
}

async function resolveProject(
  client: CoolifyClient,
  projectName: string,
  environmentName: string,
  state: CloudState,
): Promise<CloudState> {
  const next = { ...state };
  const projects = await client.get<Project[]>('/projects');
  const list = Array.isArray(projects) ? projects : [];
  let project =
    list.find((p) => p.name === projectName) ||
    list.find((p) => (p.name || '').toLowerCase() === projectName.toLowerCase());

  if (!project?.uuid) {
    log('bootstrap', `creating project "${projectName}"`);
    const created = await client.post<ProjectCreated>('/projects', {
      name: projectName,
      description: 'Namão Criativa — runtime, MongoDB, Evolution',
    });
    if (!created?.uuid) {
      throw new Error('Coolify did not return project uuid');
    }
    next.project_uuid = created.uuid;
    // Fresh project — environment may be created with default name
    const refreshed = await client.get<Project>(`/projects/${created.uuid}`);
    project = refreshed;
  } else {
    next.project_uuid = project.uuid;
    log('bootstrap', `project=${project.name} uuid=${project.uuid}`);
  }

  const envs = project.environments || [];
  let env =
    envs.find((e) => e.name === environmentName) ||
    envs.find(
      (e) => (e.name || '').toLowerCase() === environmentName.toLowerCase(),
    );

  if (!env?.uuid) {
    // Coolify creates environments via POST /projects/{uuid}/{environment_name}
    // or via create environment endpoint — try common patterns
    log(
      'bootstrap',
      `environment "${environmentName}" missing — creating via API`,
    );
    try {
      await client.post(`/projects/${next.project_uuid}/environments`, {
        name: environmentName,
      });
    } catch {
      // Fallback: some Coolify versions use POST /projects with nested env
      try {
        await client.post(`/projects/${next.project_uuid}/${environmentName}`);
      } catch (err) {
        log(
          'bootstrap',
          `WARN: could not auto-create environment. Create "${environmentName}" in Coolify UI. ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
    const refreshed = await client.get<Project>(
      `/projects/${next.project_uuid}`,
    );
    const refreshedEnvs = refreshed.environments || [];
    env =
      refreshedEnvs.find((e) => e.name === environmentName) ||
      refreshedEnvs[0];
  }

  if (env?.uuid) {
    next.environment_uuid = env.uuid;
    next.environment_name = env.name || environmentName;
    log(
      'bootstrap',
      `environment=${next.environment_name} uuid=${next.environment_uuid}`,
    );
  } else {
    next.environment_name = environmentName;
    log(
      'bootstrap',
      `WARN: environment uuid unknown — apply will use environment_name="${environmentName}"`,
    );
  }

  return next;
}

async function main() {
  loadEnv();
  const stack = loadStackConfig();
  const client = createClientFromEnv();
  let state = loadState();

  state.server_uuid = await resolveServer(client, stack.server_name);
  state = await resolveProject(
    client,
    stack.project_name,
    stack.environment_name,
    state,
  );

  saveState(state);
  log('bootstrap', 'state.json written');
  console.log(
    JSON.stringify(
      {
        server_uuid: state.server_uuid,
        project_uuid: state.project_uuid,
        environment_uuid: state.environment_uuid,
        environment_name: state.environment_name,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
