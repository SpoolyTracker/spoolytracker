import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GlobalSetting } from './global-setting.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SystemRoleGuard } from '../common/system-role.guard';
import { SystemRoles } from '../common/system-roles.decorator';

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, SystemRoleGuard)
@SystemRoles('super_admin', 'admin')
export class SystemSettingsController {
  constructor(
    @InjectRepository(GlobalSetting)
    private settingsRepository: Repository<GlobalSetting>,
  ) {}

  @Get()
  async getAllSettings() {
    return this.settingsRepository.find();
  }

  @Get(':key')
  async getSetting(@Param('key') key: string) {
    const setting = await this.settingsRepository.findOne({ where: { key } });
    if (!setting) {
      // Return a default object if not found to avoid errors on frontend
      return { key, value: '' };
    }
    return setting;
  }

  @Put(':key')
  async updateSetting(@Param('key') key: string, @Body() body: { value: string, description?: string }) {
    let setting = await this.settingsRepository.findOne({ where: { key } });
    
    if (!setting) {
      setting = this.settingsRepository.create({
        key,
        value: body.value,
        description: body.description,
      });
    } else {
      setting.value = body.value;
      if (body.description) {
        setting.description = body.description;
      }
    }

    return this.settingsRepository.save(setting);
  }
}
