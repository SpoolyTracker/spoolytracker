import { Controller, Get } from '@nestjs/common';
import { PLAN_LIMITS } from '../common/constants';

@Controller('public')
export class PublicController {
  @Get('plans')
  getPlans() {
    return PLAN_LIMITS;
  }
}
