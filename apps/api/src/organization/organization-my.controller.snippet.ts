import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrganizationService } from './organization.service';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  // Get user's organizations
  @Get('my')
  async getMyOrganizations(@Request() req: any) {
    return this.organizationService.findByUser(req.user.userId);
  }

  // ... rest of the controller methods
}
