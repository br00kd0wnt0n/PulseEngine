import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, Index } from 'typeorm'
import { User } from './User'

@Entity({ name: 'content_assets' })
export class ContentAsset {
  @PrimaryGeneratedColumn('uuid') id!: string

  @Index()
  @Column() name!: string

  @Column({ nullable: true }) url?: string

  @Column({ type: 'jsonb', default: {} }) tags!: Record<string, any>

  @Column({ type: 'jsonb', default: {} }) metadata!: Record<string, any>

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' }) owner!: User
  @Index()
  @Column('uuid') ownerId!: string

  @CreateDateColumn() createdAt!: Date
  @UpdateDateColumn() updatedAt!: Date
}

