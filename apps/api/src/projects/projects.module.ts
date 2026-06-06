import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { Project } from './entities/project.entity';
import { ProjectItem } from './entities/project-item.entity';
import { ProjectFile } from './entities/project-file.entity';
import { AuthModule } from '../auth/auth.module';
import { GcodeModule } from '../gcode/gcode.module';
import { Filament } from '../filament/filament.entity';
import { ConsumptionLog } from '../filament/consumption-log.entity';
import { Organization } from '../organization/organization.entity';
import { User } from '../auth/user.entity';
import { UserOrganization } from '../organization/user-organization.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      ProjectItem,
      ProjectFile,
      Filament,
      ConsumptionLog,
      Organization,
      User,
      UserOrganization,
    ]),
    AuthModule,
    GcodeModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
