import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm'

@Entity({ name: 'trend_summaries' })
@Index(['period', 'platform', 'windowStart'], { unique: true })
export class TrendSummary {
  @PrimaryGeneratedColumn('uuid') id!: string

  @Column({ type: 'text' }) period!: 'day' | 'week' | 'month'

  @Column({ type: 'text' }) platform!: string // 'tiktok' | 'instagram' | 'youtube' | 'news' | 'all'

  @Column({ type: 'timestamptz', name: 'window_start' }) windowStart!: Date

  @Column({ type: 'timestamptz', name: 'window_end' }) windowEnd!: Date

  @Column({ type: 'jsonb' }) payload!: any // { items: [...], meta: { updatedAt } }

  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date
}

