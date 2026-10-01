import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { AuditLog } from '../database/entities';

@Injectable()
export class AuditService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** Passer `manager` pour écrire dans la même transaction que l'opération auditée. */
  async log(
    entry: { actorId: string | null; action: string; entityType: string; entityId?: string | null; data?: Record<string, unknown> },
    manager: EntityManager = this.ds.manager,
  ): Promise<void> {
    await manager.insert(AuditLog, {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      data: (entry.data ?? {}) as never,
    });
  }
}
