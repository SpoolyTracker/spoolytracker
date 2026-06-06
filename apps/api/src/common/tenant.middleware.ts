import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Extract organizationId from header or query
    const organizationId =
      req.headers['x-organization-id'] || req.query.organizationId;

    if (!organizationId) {
      throw new UnauthorizedException('Organization ID is required');
    }

    if (organizationId) {
      // Attach to request for use in controllers
      (req as any).organizationId = parseInt(organizationId as string, 10);
    }

    next();
  }
}
