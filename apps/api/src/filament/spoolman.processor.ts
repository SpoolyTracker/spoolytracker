import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SpoolmanService } from './spoolman.service';

@Processor('spoolman-sync')
export class SpoolmanProcessor extends WorkerHost {
  private readonly logger = new Logger(SpoolmanProcessor.name);

  constructor(private readonly spoolmanService: SpoolmanService) {
    super();
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Starting Spoolman job ${job.id} (${job.name})`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Completed Spoolman job ${job.id} (${job.name})`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Failed Spoolman job ${job.id} (${job.name}): ${error.message}`,
      error.stack,
    );
  }

  async process(job: Job<any, any, string>): Promise<any> {
    await job.updateProgress(5);

    if (job.name !== 'sync') {
      throw new Error(`Unknown Spoolman job: ${job.name}`);
    }

    await job.updateProgress(15);
    const result = await this.spoolmanService.syncSpoolmanData();
    await job.updateProgress(100);
    return result;
  }
}
