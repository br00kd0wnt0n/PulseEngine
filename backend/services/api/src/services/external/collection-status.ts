/**
 * Global status tracker for APIFY collection jobs
 * Allows async collection with real-time progress polling
 */

export interface ActorProgress {
  actorId: string
  platform: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  itemsSaved: number
  error?: string
  startedAt?: Date
  completedAt?: Date
}

export interface CollectionStatus {
  jobId: string
  status: 'idle' | 'running' | 'completed' | 'failed'
  startedAt: Date | null
  completedAt: Date | null
  actors: ActorProgress[]
  totalSaved: number
  progress: number // 0-100
}

class CollectionStatusTracker {
  private currentJob: CollectionStatus | null = null

  /**
   * Start a new collection job
   */
  startJob(actorConfigs: Array<{ actorId: string; platform: string }>): string {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`

    this.currentJob = {
      jobId,
      status: 'running',
      startedAt: new Date(),
      completedAt: null,
      actors: actorConfigs.map(config => ({
        actorId: config.actorId,
        platform: config.platform,
        status: 'pending',
        itemsSaved: 0
      })),
      totalSaved: 0,
      progress: 0
    }

    return jobId
  }

  /**
   * Update actor status
   */
  updateActor(actorId: string, update: Partial<ActorProgress>): void {
    if (!this.currentJob) return

    const actor = this.currentJob.actors.find(a => a.actorId === actorId)
    if (actor) {
      Object.assign(actor, update)
      this.recalculateProgress()
    }
  }

  /**
   * Mark job as completed
   */
  completeJob(): void {
    if (!this.currentJob) return

    this.currentJob.status = 'completed'
    this.currentJob.completedAt = new Date()
    this.currentJob.progress = 100
  }

  /**
   * Mark job as failed
   */
  failJob(error: string): void {
    if (!this.currentJob) return

    this.currentJob.status = 'failed'
    this.currentJob.completedAt = new Date()
  }

  /**
   * Get current job status
   */
  getStatus(): CollectionStatus | null {
    return this.currentJob
  }

  /**
   * Clear current job
   */
  clearJob(): void {
    this.currentJob = null
  }

  /**
   * Recalculate overall progress based on actor statuses
   */
  private recalculateProgress(): void {
    if (!this.currentJob) return

    const completed = this.currentJob.actors.filter(a =>
      a.status === 'completed' || a.status === 'failed'
    ).length

    this.currentJob.progress = Math.round((completed / this.currentJob.actors.length) * 100)

    this.currentJob.totalSaved = this.currentJob.actors.reduce(
      (sum, actor) => sum + actor.itemsSaved,
      0
    )
  }
}

// Singleton instance
export const collectionStatus = new CollectionStatusTracker()
