import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, Index } from 'typeorm'
import { User } from './User.js'

@Entity({ name: 'trends' })
export class Trend {
  @PrimaryGeneratedColumn('uuid') id!: string

  @Index()
  @Column() label!: string

  @Column({ type: 'jsonb', default: {} }) signals!: Record<string, any> // cross-platform signals

  @Column({ type: 'jsonb', default: {} }) metrics!: Record<string, any> // narrative potential, temporal, etc.

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' }) owner!: User
  @Index()
  @Column('uuid') ownerId!: string

  @CreateDateColumn() createdAt!: Date
  @UpdateDateColumn() updatedAt!: Date
}

