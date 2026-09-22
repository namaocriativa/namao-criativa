import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  assertSameTenant,
  requireTenantId,
  slugifyTenantName,
  tenantWhere,
} from './tenant.util';
import { runWithTenant } from './tenant-context';

describe('tenant.util', () => {
  it('exige tenant no contexto', () => {
    expect(() => requireTenantId()).toThrow(ForbiddenException);
  });

  it('devolve tenantId do contexto', () => {
    expect(runWithTenant('t1', () => requireTenantId())).toBe('t1');
  });

  it('filtra where pelo tenant', () => {
    expect(runWithTenant('t1', () => tenantWhere({ status: 'active' }))).toEqual({
      tenantId: 't1',
      status: 'active',
    });
  });

  it('404 se o registro é de outro tenant', () => {
    expect(() =>
      runWithTenant('t1', () =>
        assertSameTenant({ id: 'x', tenantId: 't2' }, 'não achei'),
      ),
    ).toThrow(NotFoundException);
  });

  it('permite registro do mesmo tenant', () => {
    const record = { id: 'x', tenantId: 't1' };
    expect(runWithTenant('t1', () => assertSameTenant(record))).toBe(record);
  });

  it('sem contexto não bloqueia leitura pública', () => {
    expect(assertSameTenant({ id: 'x', tenantId: 't1' })).toEqual({
      id: 'x',
      tenantId: 't1',
    });
  });

  it('slugify remove acento e espaços', () => {
    expect(slugifyTenantName('Namão Criativa')).toBe('namao-criativa');
  });
});
