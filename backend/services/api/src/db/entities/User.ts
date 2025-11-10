import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'

export type UserRole = 'user' | 'admin'

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid') id!: string

  @Index({ unique: true })
  @Column() email!: string

  @Column() passwordHash!: string

  @Column({ type: 'text', default: 'user' }) role!: UserRole

  @CreateDateColumn() createdAt!: Date
  @UpdateDateColumn() updatedAt!: Date
}

