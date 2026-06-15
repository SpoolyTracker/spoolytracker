import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CreateProjectExternalItemDto } from './dto/create-project-external-item.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrganizationGuard } from '../common/organization.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as crypto from 'crypto';

@Controller('projects')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @Post()
  create(@Request() req: any, @Body() createProjectDto: CreateProjectDto) {
    req.user.organizationId = req.organizationId;
    return this.projectsService.create(createProjectDto, req.user);
  }

  @Get()
  findAll(@Request() req: any) {
    req.user.organizationId = req.organizationId;
    return this.projectsService.findAll(req.user);
  }

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    req.user.organizationId = req.organizationId;
    return this.projectsService.findOne(+id, req.user);
  }

  @Patch(':id')
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    req.user.organizationId = req.organizationId;
    return this.projectsService.update(+id, updateProjectDto, req.user);
  }

  @Delete(':id')
  remove(
    @Request() req: any,
    @Param('id') id: string,
    @Query('deleteConsumptions') deleteConsumptions?: string,
  ) {
    req.user.organizationId = req.organizationId;
    return this.projectsService.remove(
      +id,
      req.user,
      deleteConsumptions === 'true',
    );
  }

  @Post(':id/items')
  addItem(
    @Request() req: any,
    @Param('id') id: string,
    @Body() createProjectItemDto: any,
  ) {
    req.user.organizationId = req.organizationId;
    return this.projectsService.addItem(+id, createProjectItemDto, req.user);
  }

  @Delete(':id/items/:itemId')
  removeItem(
    @Request() req: any,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    req.user.organizationId = req.organizationId;
    return this.projectsService.removeItem(+id, +itemId, req.user);
  }

  @Patch(':id/items/:itemId')
  updateItem(
    @Request() req: any,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() data: any,
  ) {
    req.user.organizationId = req.organizationId;
    return this.projectsService.updateItem(+id, +itemId, data, req.user);
  }

  @Post(':id/external-items')
  addExternalItem(
    @Request() req: any,
    @Param('id') id: string,
    @Body() createProjectExternalItemDto: CreateProjectExternalItemDto,
  ) {
    req.user.organizationId = req.organizationId;
    return this.projectsService.addExternalItem(
      +id,
      createProjectExternalItemDto,
      req.user,
    );
  }

  @Delete(':id/external-items/:itemId')
  removeExternalItem(
    @Request() req: any,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    req.user.organizationId = req.organizationId;
    return this.projectsService.removeExternalItem(+id, +itemId, req.user);
  }

  @Patch(':id/external-items/:itemId')
  updateExternalItem(
    @Request() req: any,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() data: Partial<CreateProjectExternalItemDto>,
  ) {
    req.user.organizationId = req.organizationId;
    return this.projectsService.updateExternalItem(+id, +itemId, data, req.user);
  }

  @Post(':id/files')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const randomName = crypto.randomBytes(16).toString('hex');
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB global limit (plan-specific check in service)
      fileFilter: (_req, file, cb) => {
        const forbidden = (file.originalname || '')
          .toLowerCase()
          .match(/\.(exe|sh|bat|php|js|html)$/i);
        if (forbidden) return cb(new Error('Forbidden file type'), false);
        cb(null, true);
      },
    }),
  )
  uploadFile(
    @Request() req: any,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    req.user.organizationId = req.organizationId;
    return this.projectsService.uploadFile(+id, file, req.user);
  }

  @Delete(':id/files/:fileId')
  removeFile(
    @Request() req: any,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
  ) {
    req.user.organizationId = req.organizationId;
    return this.projectsService.removeFile(+id, +fileId, req.user);
  }

  @Post(':id/files/:fileId/analyze')
  analyzeFile(
    @Request() req: any,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
  ) {
    req.user.organizationId = req.organizationId;
    return this.projectsService.analyzeFile(+id, +fileId, req.user);
  }

  @Post(':id/consumption')
  addConsumption(
    @Request() req: any,
    @Param('id') id: string,
    @Body() data: any,
  ) {
    req.user.organizationId = req.organizationId;
    return this.projectsService.addConsumption(+id, data, req.user);
  }

  @Delete(':id/consumption/:logId')
  removeConsumption(
    @Request() req: any,
    @Param('id') id: string,
    @Param('logId') logId: string,
  ) {
    req.user.organizationId = req.organizationId;
    return this.projectsService.removeConsumption(+id, +logId, req.user);
  }

  @Patch(':id/consumption/:logId')
  updateConsumption(
    @Request() req: any,
    @Param('id') id: string,
    @Param('logId') logId: string,
    @Body() data: any,
  ) {
    req.user.organizationId = req.organizationId;
    return this.projectsService.updateConsumption(+id, +logId, data, req.user);
  }
  @Get(':id/report')
  async getReport(
    @Request() req: any,
    @Param('id') id: string,
    @Query('lang') lang: string,
    @Res({ passthrough: true }) res: any,
  ) {
    req.user.organizationId = req.organizationId;
    const buffer = await this.projectsService.exportProjectReport(
      +id,
      req.user,
      lang,
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="project_report_${id}.xlsx"`,
    });

    return new StreamableFile(buffer);
  }
  @Get(':id/feasibility')
  checkFeasibility(@Request() req: any, @Param('id') id: string) {
    req.user.organizationId = req.organizationId;
    return this.projectsService.checkFeasibility(+id, req.user);
  }
}
