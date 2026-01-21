import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'audit_events' })
@Index(['entityType', 'entityId', 'createdAt'])
export class AuditEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'entity_type', type: 'text' })
  entityType!: string;

  @Column({ name: 'entity_id', type: 'text' })
  entityId!: string;

  @Column({ name: 'event_type', type: 'text' })
  eventType!: string;

  @Column({ name: 'payload_json', type: 'jsonb' })
  payloadJson!: Record<string, any>;

  @Column({ type: 'text' })
  actor!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
