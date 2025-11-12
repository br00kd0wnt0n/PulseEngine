import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne } from 'typeorm'
import { Project } from './Project.js'

@Entity({ name: 'conversation_messages' })
export class ConversationMessage {
  @PrimaryGeneratedColumn('uuid') id!: string

  @Index()
  @Column('uuid') projectId!: string
  @ManyToOne(() => Project, { onDelete: 'CASCADE' }) project!: Project

  @Column({ type: 'text' }) role!: 'user' | 'ai'
  @Column({ type: 'text' }) content!: string

  @CreateDateColumn() createdAt!: Date
}

