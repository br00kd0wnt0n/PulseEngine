import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne } from 'typeorm'
import { User } from './User.js'

@Entity({ name: 'projects' })
export class Project {
  @PrimaryGeneratedColumn('uuid') id!: string

  @Index()
  @Column('uuid') ownerId!: string
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) owner!: User

  @Column({ type: 'text' }) concept!: string
  @Column({ type: 'text', default: 'Social Strategist' }) persona!: string

  @Column({ type: 'text', array: true, default: '{}' }) platforms!: string[]
  @Column({ type: 'text', array: true, default: '{}' }) areasOfInterest!: string[]

  @Column({ type: 'text', nullable: true }) narrative!: string | null
  @Column({ type: 'jsonb', default: {} }) scores!: Record<string, any>

  @CreateDateColumn() createdAt!: Date
  @UpdateDateColumn() updatedAt!: Date
}

