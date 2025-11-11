import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'

@Entity({ name: 'platform_metrics' })
export class PlatformMetric {
  @PrimaryGeneratedColumn('uuid') id!: string
  @Index()
  @Column('uuid') trendId!: string
  @Index()
  @Column({ type: 'text' }) platform!: string // e.g., TikTok, YouTube, Instagram
  @Column({ type: 'int', default: 0 }) engagement!: number // likes+comments proxy
  @Column({ type: 'float', default: 0 }) velocity!: number // simple growth proxy
  @UpdateDateColumn() updatedAt!: Date
  @CreateDateColumn() createdAt!: Date
}

