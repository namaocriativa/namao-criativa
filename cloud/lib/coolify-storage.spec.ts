import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasPersistentMount,
  listPersistentMounts,
  RUNTIME_STORAGE_MOUNT,
} from './coolify-storage.js';

test('listPersistentMounts lê nested persistent_storages', () => {
  const mounts = listPersistentMounts({
    persistent_storages: [
      { name: 'namao-api-storage', mount_path: RUNTIME_STORAGE_MOUNT },
    ],
  });
  assert.equal(mounts.length, 1);
  assert.equal(mounts[0]?.mount_path, RUNTIME_STORAGE_MOUNT);
});

test('listPersistentMounts aceita array cru da API', () => {
  const mounts = listPersistentMounts([
    { mount_path: '/evolution/instances' },
    { mount_path: RUNTIME_STORAGE_MOUNT },
  ]);
  assert.equal(mounts.length, 2);
  assert.equal(hasPersistentMount(mounts, RUNTIME_STORAGE_MOUNT), true);
  assert.equal(hasPersistentMount(mounts, '/missing'), false);
});
