import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity({ name: 'content_assets' })
export class ContentAsset {
  @PrimaryGeneratedColumn('uuid') id!: string
  @Column() name!: string
  @Column({ nullable: true }) url?: string | null
  @Column({ type: 'jsonb', default: {} }) tags!: Record<string, any>
  @Column({ type: 'jsonb', default: {} }) metadata!: Record<string, any>
  @Column('uuid') ownerId!: string
  @CreateDateColumn() createdAt!: Date
  @UpdateDateColumn() updatedAt!: Date
}

