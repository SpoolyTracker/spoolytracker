import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as packageJson from '../../package.json';
import { isSelfHosted } from '../common/self-hosted';

@ApiTags('version')
@Controller('version')
export class VersionController {
  constructor(private configService: ConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'Get API version and minimum required mobile version',
  })
  @ApiResponse({ status: 200, description: 'Version information' })
  getVersion() {
    return {
      version: packageJson.version,
      minMobileVersion: this.configService.get('MIN_MOBILE_VERSION', '0.5.5'),
      iosUpdateUrl: this.configService.get(
        'MOBILE_UPDATE_URL_IOS',
        'https://apps.apple.com/app/id6760127825',
      ),
      androidUpdateUrl: this.configService.get(
        'MOBILE_UPDATE_URL_ANDROID',
        'https://play.google.com/store/apps/details?id=com.spoolytracker.mobile',
      ),
      selfHosted: isSelfHosted(),
    };
  }
}
