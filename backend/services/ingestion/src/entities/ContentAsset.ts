import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity({ name: 'content_assets' })
export class ContentAsset {
  @PrimaryGeneratedColumn('uuid') id!: string
  @Column({ type: 'text' }) name!: string
  @Column({ type: 'text', nullable: true }) url?: string | null
  @Column({ type: 'jsonb', default: {} }) tags!: Record<string, any>
  @Column({ type: 'jsonb', default: {} }) metadata!: Record<string, any>
  @Column({ type: 'uuid' }) ownerId!: string
  @Column({ type: 'uuid', nullable: true }) projectId?: string | null
  @CreateDateColumn() createdAt!: Date
  @UpdateDateColumn() updatedAt!: Date
}

