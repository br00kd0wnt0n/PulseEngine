import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, Index } from 'typeorm'
import { Project } from './Project.js'

@Entity({ name: 'project_versions' })
export class ProjectVersion {
  @PrimaryGeneratedColumn('uuid') id!: string

  @Index()
  @Column('uuid') projectId!: string
  @ManyToOne(() => Project, { onDelete: 'CASCADE' }) project!: Project

  @Column({ type: 'text' }) summary!: string
  @Column({ type: 'text', nullable: true }) narrative!: string | null
  @Column({ type: 'jsonb', default: {} }) scores!: Record<string, any>
  @Column({ type: 'text', nullable: true }) changeSummary!: string | null

  @CreateDateColumn() createdAt!: Date
}

