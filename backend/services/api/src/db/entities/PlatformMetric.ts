import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'

@Entity({ name: 'platform_metrics' })
export class PlatformMetric {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index()
  @Column({ type: 'varchar', length: 50 })
  platform!: string // tiktok, instagram, youtube, twitter, news, wiki, fandom

  @Index()
  @Column({ type: 'varchar', length: 100 })
  metric_type!: string // trending_hashtag, viral_video, news_story, etc.

  @Column({ type: 'integer', default: 0 })
  engagement!: number // likes, shares, views combined

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  velocity!: number // growth rate or trending velocity

  @Column({ type: 'jsonb', default: {} })
  value!: Record<string, any> // Full data from Apify

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, any> // Additional context

  @Index()
  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}

