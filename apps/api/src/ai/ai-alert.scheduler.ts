import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AiAlertService } from './ai-alert.service';

@Injectable()
export class AiAlertScheduler {
  private readonly logger = new Logger(AiAlertScheduler.name);

  constructor(private readonly aiAlertService: AiAlertService) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async handleDailyScan(): Promise<void> {
    this.logger.debug('Demarrage du scan quotidien des alertes IA.');
    await this.aiAlertService.runScheduledScan();
  }
}
