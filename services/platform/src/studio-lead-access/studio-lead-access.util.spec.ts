import { USER_ROLE } from '../auth/roles';
import {
  canAccessRecord,
  canManageShares,
  presentStudioProfile,
  visibleWhere,
} from './studio-lead-access.util';

const admin = { id: 'admin-1', role: USER_ROLE.ADMIN };
const operator = { id: 'op-1', role: USER_ROLE.OPERATOR };
const other = { id: 'op-2', role: USER_ROLE.OPERATOR };

describe('studio-lead-access.util', () => {
  it('admin vê tudo; operador só os próprios ou compartilhados', () => {
    expect(visibleWhere(admin)).toEqual({});
    expect(visibleWhere(operator)).toEqual({
      OR: [
        { createdByUserId: 'op-1' },
        { studioShares: { some: { userId: 'op-1' } } },
      ],
    });
  });

  it('canAccessRecord cobre admin, dono, share e bloqueia o resto', () => {
    const owned = { createdByUserId: 'op-1', studioShares: [] };
    const shared = {
      createdByUserId: 'op-2',
      studioShares: [{ userId: 'op-1' }],
    };
    const unassigned = { createdByUserId: null, studioShares: [] };

    expect(canAccessRecord(admin, unassigned)).toBe(true);
    expect(canAccessRecord(operator, owned)).toBe(true);
    expect(canAccessRecord(operator, shared)).toBe(true);
    expect(canAccessRecord(operator, unassigned)).toBe(false);
    expect(canAccessRecord(other, owned)).toBe(false);
  });

  it('só admin ou criador gerenciam shares', () => {
    expect(canManageShares(admin, null)).toBe(true);
    expect(canManageShares(operator, 'op-1')).toBe(true);
    expect(canManageShares(operator, 'op-2')).toBe(false);
    expect(canManageShares(operator, null)).toBe(false);
  });

  it('present omite criador para operador e marca compartilhado', () => {
    const record = {
      id: 'lead-1',
      name: 'Firma',
      createdByUserId: 'op-2',
      createdBy: { id: 'op-2', name: 'Bia', email: 'bia@n.co' },
      studioShares: [{ userId: 'op-1' }],
    };

    expect(presentStudioProfile(admin, record)).toMatchObject({
      id: 'lead-1',
      sharedWithMe: false,
      canManageShares: true,
      createdBy: { id: 'op-2', name: 'Bia', email: 'bia@n.co' },
    });
    expect(presentStudioProfile(admin, record)).not.toHaveProperty(
      'createdByUserId',
    );
    expect(presentStudioProfile(admin, record)).not.toHaveProperty(
      'studioShares',
    );

    const asOperator = presentStudioProfile(operator, record);
    expect(asOperator).toMatchObject({
      id: 'lead-1',
      sharedWithMe: true,
      canManageShares: false,
    });
    expect(asOperator).not.toHaveProperty('createdBy');
    expect(asOperator).not.toHaveProperty('createdByUserId');
  });
});
