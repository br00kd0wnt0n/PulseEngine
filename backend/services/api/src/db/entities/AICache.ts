import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm'

@Entity({ name: 'ai_cache' })
export class AICache {
  @PrimaryColumn('text') key!: string
  @Column({ type: 'jsonb' }) value!: any
  @CreateDateColumn() createdAt!: Date
}

