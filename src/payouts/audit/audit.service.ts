import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { AuditPolicy } from './audit-policy';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditEventEntity) private auditRepo: Repository<AuditEventEntity>,
    private policy: AuditPolicy
  ) {}

  async writeEvent(params: {
    entityType: string;
    entityId: string;
    eventType: string;
    payload: Record<string, any>;
    actor: string;
  }): Promise<void> {
    const payloadJson = this.policy.buildPayload(params.eventType, params.payload);
    const row = this.auditRepo.create({
      entityType: params.entityType,
      entityId: params.entityId,
      eventType: params.eventType,
      payloadJson,
      actor: params.actor
    });
    await this.auditRepo.save(row);
  }
}
