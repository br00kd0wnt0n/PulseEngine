import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, Index } from 'typeorm'
import { User } from './User.js'

@Entity({ name: 'creators' })
export class Creator {
  @PrimaryGeneratedColumn('uuid') id!: string

  @Index()
  @Column() name!: string

  @Column({ nullable: true }) platform?: string

  @Column({ nullable: true }) category?: string

  @Column({ type: 'jsonb', default: {} }) metadata!: Record<string, any>

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' }) owner!: User
  @Index()
  @Column('uuid') ownerId!: string

  @CreateDateColumn() createdAt!: Date
  @UpdateDateColumn() updatedAt!: Date
}

