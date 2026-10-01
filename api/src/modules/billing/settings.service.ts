import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { AuditService } from '../../common/audit.service';
import { AuthUser } from '../../common/auth.decorators';
import { assertIfMatch } from '../../common/etag';
import { DEFAULT_BILLING_SETTINGS } from '../../database/migrations/1759300000000-Billing';

export type BillingSettings = typeof DEFAULT_BILLING_SETTINGS;

@Injectable()
export class BillingSettingsService {
  constructor(@InjectDataSource() private readonly ds: DataSource, private readonly audit: AuditService) {}

  async get(m: EntityManager = this.ds.manager): Promise<BillingSettings & { version: number }> {
    const [row] = await m.query(`SELECT value, version FROM settings WHERE key = 'billing'`);
    return { ...DEFAULT_BILLING_SETTINGS, ...row.value, version: row.version };
  }

  async update(patch: Partial<BillingSettings>, ifMatch: string | undefined, actor: AuthUser) {
    return this.ds.transaction(async (m) => {
      const [row] = await m.query(`SELECT value, version FROM settings WHERE key = 'billing' FOR UPDATE`);
      assertIfMatch(ifMatch, row.version);
      const value = { ...row.value };
      for (const [k, v] of Object.entries(patch)) {
        value[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...(value[k] ?? {}), ...v } : v;
      }
      await m.query(`UPDATE settings SET value = $1, version = version + 1, updated_at = now() WHERE key = 'billing'`, [
        JSON.stringify(value),
      ]);
      await this.audit.log({ actorId: actor.id, action: 'settings.billing_updated', entityType: 'settings', data: { patch } }, m);
      return this.get(m);
    });
  }
}
