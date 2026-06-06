import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project, ProjectStatus } from './entities/project.entity';
import { Organization } from '../organization/organization.entity';
import { ProjectItem } from './entities/project-item.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

import { ProjectFile, ProjectFileType } from './entities/project-file.entity';
import { GcodeAnalyzerService } from '../gcode/gcode-analyzer.service';
import { PLAN_LIMITS } from '../common/constants';
import { isSelfHosted, SELF_HOSTED_PLAN } from '../common/self-hosted';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { Filament } from '../filament/filament.entity';
import {
  ConsumptionLog,
  ConsumptionType,
} from '../filament/consumption-log.entity';

import { User } from '../auth/user.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private projectsRepository: Repository<Project>,
    @InjectRepository(ProjectItem)
    private projectItemsRepository: Repository<ProjectItem>,
    @InjectRepository(ProjectFile)
    private projectFilesRepository: Repository<ProjectFile>,
    @InjectRepository(Filament)
    private filamentRepository: Repository<Filament>,
    @InjectRepository(ConsumptionLog)
    private consumptionLogRepository: Repository<ConsumptionLog>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private gcodeAnalyzer: GcodeAnalyzerService,
  ) {}

  // ... (existing code)

  async addConsumption(
    projectId: number,
    data: {
      filamentId: number;
      amount: number;
      type: string;
      notes?: string;
      isPlanned?: boolean;
    },
    user: any,
  ) {
    const project = await this.findOne(projectId, user);

    let filament: Filament | undefined = undefined;
    const amount = data.amount;
    const notes = data.notes;
    const type = data.type;

    let isPlanned = data.isPlanned;
    if (isPlanned === undefined) {
      isPlanned = project.status === ProjectStatus.PLANNING;
    }

    if (data.filamentId) {
      const found = await this.filamentRepository.findOne({
        where: { id: data.filamentId },
      });
      if (!found)
        throw new NotFoundException(`Filament #${data.filamentId} not found`);
      filament = found;

      // Deduct from stock only if NOT planned
      if (!isPlanned) {
        filament.weightRemaining -= amount;
        if (filament.weightRemaining < 0) filament.weightRemaining = 0;
        await this.filamentRepository.save(filament);
      }
    }

    const log = this.consumptionLogRepository.create({
      project: { id: project.id },
      filament: filament ? { id: filament.id } : undefined,
      amount: amount,
      type: (type as ConsumptionType) || ConsumptionType.MANUAL,
      is_planned: isPlanned,
      notes: notes,
      date: new Date(),
    });

    return this.consumptionLogRepository.save(log);
  }

  async removeConsumption(projectId: number, logId: number, user: any) {
    const project = await this.findOne(projectId, user);

    const log = await this.consumptionLogRepository.findOne({
      where: { id: logId, project: { id: project.id } },
      relations: ['filament'],
    });

    if (!log) throw new NotFoundException('Consumption log not found');

    // Restore stock if filament exists and it was NOT planned
    if (log.filament && !log.is_planned) {
      log.filament.weightRemaining =
        (Number(log.filament.weightRemaining) || 0) + Number(log.amount);
      await this.filamentRepository.save(log.filament);
    }

    return this.consumptionLogRepository.remove(log);
  }

  async updateConsumption(
    projectId: number,
    logId: number,
    data: any,
    user: any,
  ) {
    const project = await this.findOne(projectId, user);
    const log = await this.consumptionLogRepository.findOne({
      where: { id: logId, project: { id: project.id } },
      relations: ['filament'],
    });

    if (!log) throw new NotFoundException('Consumption log not found');

    // Handle stock adjustment if amount or filament changed
    // Complex logic:
    // 1. Revert old consumption if it was NOT planned
    if (log.filament && !log.is_planned) {
      log.filament.weightRemaining =
        (Number(log.filament.weightRemaining) || 0) + Number(log.amount);
      await this.filamentRepository.save(log.filament);
    }

    // 2. Apply new consumption
    // Assuming data contains updated fields or partials
    // If filamentId changed, fetch new filament.
    // For simplicity allow updating: amount, notes, type. Filament change logic is complex if filamentId is passed.

    if (data.notes !== undefined) log.notes = data.notes;
    if (data.is_planned !== undefined) log.is_planned = data.is_planned;
    if (data.type !== undefined) log.type = data.type;
    if (data.date !== undefined) log.date = new Date(data.date);

    /* Full stock logic for update is risky without full DTO validation. 
           User specifically asked for edit. Usually manual entries are about typos in amount or notes.
           If amount changes, we re-consume from the SAME filament unless filamentId is changed.
        */

    let targetFilament = log.filament;
    if (
      data.filamentId &&
      (!log.filament || log.filament.id !== data.filamentId)
    ) {
      const found = await this.filamentRepository.findOne({
        where: { id: data.filamentId },
      });
      if (!found) throw new NotFoundException('New filament not found');
      targetFilament = found;
      log.filament = targetFilament;
    }

    if (data.amount !== undefined) {
      log.amount = Number(data.amount);
    }

    // 2. Apply new consumption IF it is NOT planned
    if (!log.is_planned && targetFilament) {
      targetFilament.weightRemaining =
        (Number(targetFilament.weightRemaining) || 0) - Number(log.amount);
      if (targetFilament.weightRemaining < 0)
        targetFilament.weightRemaining = 0;
      await this.filamentRepository.save(targetFilament);
    }

    return this.consumptionLogRepository.save(log);
  }

  async create(createProjectDto: CreateProjectDto, user: any) {
    // SC: Bypass for System Admins
    const isSystemAdmin =
      user.isSuperAdmin ||
      user.systemRole === 'admin' ||
      user.systemRole === 'super_admin';

    if (!isSystemAdmin && !isSelfHosted()) {
      // Check Quota here
      const count = await this.projectsRepository.count({
        where: { organization: { id: user.organizationId } },
      });

      const org = await this.organizationRepository.findOne({
        where: { id: user.organizationId },
      });
      if (!org) throw new NotFoundException('Organization not found');

      const limits = PLAN_LIMITS[org.plan || 'free'];
      const maxProjects = limits?.maxProjectsPerOrg ?? 3;

      if (maxProjects !== Infinity && count >= maxProjects) {
        throw new ForbiddenException(
          `Project limit reached for your plan (${maxProjects}). Upgrade to PRO for more.`,
        );
      }
    }

    const project = this.projectsRepository.create({
      ...createProjectDto,
      created_by: { id: user.userId },
      organization: { id: user.organizationId },
    });
    return this.projectsRepository.save(project);
  }

  findAll(user: any) {
    return this.projectsRepository.find({
      where: { organization: { id: user.organizationId } },
      // Eager-load the item filament chain so consumers (notably the AI
      // context at /ai/context) can resolve each requirement's material/color.
      // Without it, requirements collapse to "Inconnu/Inconnu" and healthy
      // projects get flagged as at-risk.
      relations: [
        'items',
        'items.filament',
        'items.filament.brand',
        'items.filament.material',
        'files',
      ],
      order: { updated_at: 'DESC' },
    });
  }

  async findOne(id: number, user: any) {
    const project = await this.projectsRepository.findOne({
      where: { id, organization: { id: user.organizationId } },
      relations: [
        'items',
        'files',
        'items.filament',
        'items.filament.brand',
        'items.filament.material',
        'consumptionLogs',
        'consumptionLogs.filament',
        'consumptionLogs.filament.brand',
        'consumptionLogs.filament.material',
        'organization',
      ],
    });
    if (!project) throw new NotFoundException(`Project #${id} not found`);
    return project;
  }

  async update(id: number, updateProjectDto: UpdateProjectDto, user: any) {
    console.log('Updating project', id, updateProjectDto);
    const project = await this.findOne(id, user);

    // Manual merge/convert for strict typing
    if (updateProjectDto.name) project.name = updateProjectDto.name;
    if (updateProjectDto.status) project.status = updateProjectDto.status;
    if (updateProjectDto.description !== undefined)
      project.description = updateProjectDto.description;

    // Handle Date conversion
    if (updateProjectDto.start_date !== undefined) {
      project.start_date = updateProjectDto.start_date
        ? new Date(updateProjectDto.start_date)
        : null;
    }
    if (updateProjectDto.end_date !== undefined) {
      project.end_date = updateProjectDto.end_date
        ? new Date(updateProjectDto.end_date)
        : null;
    }

    // Merge remaining fields if any (careful with types)
    const { start_date, end_date, ...rest } = updateProjectDto;
    this.projectsRepository.merge(project, rest as any);

    console.log('Merged project', project);

    // Auto-update status based on dates
    const now = new Date();
    const start = project.start_date ? new Date(project.start_date) : null;
    const end = project.end_date ? new Date(project.end_date) : null;

    // Only auto-update if status wasn't explicitly set to ARCHIVED (unless we want full auto)
    // User request: "status change alone function of start/end date"
    if (project.status !== ProjectStatus.ARCHIVED) {
      if (end && end < now) {
        project.status = ProjectStatus.COMPLETED;
      } else if (start && start <= now) {
        // If it was completed but end date moved or just normal flow
        project.status = ProjectStatus.IN_PROGRESS;
      } else if (start && start > now) {
        project.status = ProjectStatus.PLANNING;
      }
    }

    return this.projectsRepository.save(project);
  }

  async remove(id: number, user: any, deleteConsumptions: boolean = false) {
    const project = await this.projectsRepository.findOne({
      where: { id, organization: { id: user.organizationId } },
      relations: ['files'],
    });

    if (!project) throw new NotFoundException(`Project #${id} not found`);

    if (deleteConsumptions) {
      const logs = await this.consumptionLogRepository.find({
        where: { project: { id: project.id } },
        relations: ['filament'],
      });

      for (const log of logs) {
        if (log.filament && !log.is_planned) {
          log.filament.weightRemaining =
            (Number(log.filament.weightRemaining) || 0) + Number(log.amount);
          await this.filamentRepository.save(log.filament);
        }
        await this.consumptionLogRepository.remove(log);
      }
    }

    const fs = require('fs');
    const path = require('path');

    if (project.files) {
      for (const file of project.files) {
        try {
          // Check if file_url is a local path (not http/s)
          if (file.file_url && !file.file_url.startsWith('http')) {
            // Resolve absolute path. Assuming file_url is relative to root or is absolute from Multer
            // Multer usually gives absolute path in 'path' property if dist is used, or relative.
            // Let's assume file_url is correct usage path.
            // Safe check: file exists
            if (fs.existsSync(file.file_url)) {
              fs.unlinkSync(file.file_url);
            }
          }
        } catch (e) {
          console.error(`Failed to delete file ${file.file_url}:`, e);
          // Continue deletion even if file cleanup fails
        }
      }
    }

    return this.projectsRepository.remove(project);
  }

  async addItem(projectId: number, createProjectItemDto: any, user: any) {
    const project = await this.findOne(projectId, user);

    // Check if item already exists for this filament to merge quantities
    if (createProjectItemDto.filamentId) {
      const existingItem = await this.projectItemsRepository.findOne({
        where: {
          project: { id: projectId },
          filament: { id: createProjectItemDto.filamentId },
        },
      });

      if (existingItem) {
        existingItem.weight_required_g =
          (Number(existingItem.weight_required_g) || 0) +
          (Number(createProjectItemDto.weight_required_g) || 0);
        return this.projectItemsRepository.save(existingItem);
      }
    }

    const item = this.projectItemsRepository.create({
      ...createProjectItemDto,
      project: { id: project.id },
    });
    return this.projectItemsRepository.save(item);
  }

  async removeItem(projectId: number, itemId: number, user: any) {
    const project = await this.findOne(projectId, user); // Ensure ownership
    const item = await this.projectItemsRepository.findOne({
      where: { id: itemId, project: { id: project.id } },
    });
    if (!item) throw new NotFoundException(`Item #${itemId} not found`);
    return this.projectItemsRepository.remove(item);
  }

  // In projects.service.ts
  // Add import { GcodeAnalyzerService } from '../gcode/gcode-analyzer.service';
  // Add import { ProjectFile, ProjectFileType } from './entities/project-file.entity';
  // Inject Repository<ProjectFile> and GcodeAnalyzerService

  async uploadFile(projectId: number, file: Express.Multer.File, user: any) {
    const project = await this.findOne(projectId, user);

    // Check file size against plan limit
    const plan = isSelfHosted()
      ? SELF_HOSTED_PLAN
      : project.organization?.plan || 'free';
    const limits = PLAN_LIMITS[plan];
    const maxMb = limits?.maxFileUploadSizeMb || 10;
    if (file.size > maxMb * 1024 * 1024) {
      throw new BadRequestException(
        `File size limit for your plan (${plan}) is ${maxMb}MB`,
      );
    }

    // Determine type
    let file_type = ProjectFileType.OTHER;
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    const isGCodeExt = ['gcode', 'gco', 'bgcode', 'm3d'].includes(ext || '');
    const is3MF = ext === '3mf';

    if (isGCodeExt) file_type = ProjectFileType.GCODE;
    else if (['stl', 'obj', '3mf', 'step'].includes(ext || ''))
      file_type = ProjectFileType.MODEL;
    else if (['jpg', 'png', 'jpeg', 'webp'].includes(ext || ''))
      file_type = ProjectFileType.IMAGE;

    // Check total file count against plan limit
    const currentFileCount = await this.projectFilesRepository.count({
      where: { projectId: project.id },
    });
    const maxFiles = (PLAN_LIMITS[plan] as any)?.maxFilesPerProject ?? 3;

    if (maxFiles !== Infinity && currentFileCount >= maxFiles) {
      const fs = require('fs');
      if (fs.existsSync(file.path))
        try {
          fs.unlinkSync(file.path);
        } catch {}
      throw new BadRequestException(
        `File limit for your plan (${plan}) is ${maxFiles}. Please delete an existing file to upload a new one.`,
      );
    }

    let analysis_metadata: any = null;
    let shouldDeleteFile = false;

    const analysisResult = await this.performAnalysis(
      {
        originalname: file.originalname,
        path: file.path,
      },
      project,
    );

    analysis_metadata = analysisResult.metadata;
    shouldDeleteFile = analysisResult.shouldDelete;

    // Create ProjectFile record
    // Note: Real implementation would move file to permanent storage provided by Multer or custom logic.
    // Assuming Multer saves to 'uploads/' and we use that path.
    const safeFilePath = file.path.replace(/\\/g, '/');
    const projectFile = this.projectFilesRepository.create({
      project: { id: project.id },
      projectId: project.id,
      file_name: file.originalname,
      file_url: shouldDeleteFile ? null : safeFilePath,
      file_type: file_type,
      file_size: file.size,
      analysis_metadata: analysis_metadata,
    });

    const savedFile = await this.projectFilesRepository.save(projectFile);

    // If it's an image and project doesn't have a cover yet, set it
    if (file_type === ProjectFileType.IMAGE && !project.image_url) {
      // Use update to avoid TypeORM cascade relation issues overriding project files
      await this.projectsRepository.update(project.id, {
        image_url: `/${safeFilePath}`,
      });
    }

    // Delete the original uploaded file if analyzed successfully and requested
    if (shouldDeleteFile && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch (e) {
        console.error('Failed to delete physical GCode file', e);
      }
    }

    return savedFile;
  }

  async analyzeFile(projectId: number, fileId: number, user: any) {
    const project = await this.findOne(projectId, user);
    const file = await this.projectFilesRepository.findOne({
      where: { id: fileId, project: { id: project.id } },
    });

    if (!file) throw new NotFoundException(`File #${fileId} not found`);
    if (!file.file_url)
      throw new BadRequestException(
        `No physical file to analyze for file #${fileId}`,
      );

    // Try to find the file on disk
    let filePath = file.file_url;
    if (!fs.existsSync(filePath)) {
      // Try relative to root
      filePath = path.join(process.cwd(), file.file_url);
    }
    if (!fs.existsSync(filePath)) {
      // Try in uploads folder specifically
      filePath = path.join(
        process.cwd(),
        'uploads',
        path.basename(file.file_url),
      );
    }

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(
        `Physical file not found on disk: ${file.file_url}`,
      );
    }

    const result = await this.performAnalysis(
      {
        originalname: file.file_name,
        path: filePath,
      },
      project,
    );

    if (!result.metadata) {
      throw new BadRequestException('Analysis failed to produce results');
    }

    file.analysis_metadata = result.metadata;
    if (result.shouldDelete) {
      file.file_url = null;
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.error(
          'Failed to delete physical GCode file after manual analysis',
          e,
        );
      }
    }

    return this.projectFilesRepository.save(file);
  }

  private async performAnalysis(
    file: { originalname: string; path: string },
    project: Project,
  ) {
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    const isGCodeExt = ['gcode', 'gco', 'bgcode', 'm3d'].includes(ext || '');
    const is3MF = ext === '3mf';

    if (!isGCodeExt && !is3MF) return { metadata: null, shouldDelete: false };

    try {
      let analysisFiles = [{ name: file.originalname, path: file.path }];
      let isTempFiles = false;
      let file_type = isGCodeExt
        ? ProjectFileType.GCODE
        : ProjectFileType.OTHER;

      if (is3MF) {
        const extracted = this.gcodeAnalyzer.extract3MFGCode(file.path);
        if (extracted.length > 0) {
          analysisFiles = extracted;
          isTempFiles = true;
          file_type = ProjectFileType.GCODE;
        }
      }

      if (file_type === ProjectFileType.GCODE) {
        const firstFile = analysisFiles[0];
        const settings = await this.gcodeAnalyzer.detectSettingsFromFile(
          firstFile.path,
          1.75,
        );
        const plates = [];
        const allTools = new Set<string>();

        for (const f of analysisFiles) {
          const plateStream = fs.createReadStream(f.path);
          const analysis = await this.gcodeAnalyzer.analyzeVolumesLocked(
            plateStream,
            { filamentDiameterMm: 1.75 },
            {
              eMode: settings.eMode,
              eUnit: settings.eUnit,
              nozzleDiameter: settings.slicer?.nozzleDiameter,
            },
          );

          const tools = Object.keys(analysis.tools);
          tools.forEach((t) => allTools.add(t));

          plates.push({
            name: f.name,
            tools: tools,
            volumes: analysis.tools,
            totals: analysis.totals,
            meta: analysis.meta,
          });
        }

        const metadata = {
          tools: Array.from(allTools).sort(),
          plates: plates,
          slicerReport: settings.slicer,
          estimatedTimeSeconds: settings.slicer?.estimatedTimeSeconds,
        };

        // Clean up temp files from 3MF extraction
        if (isTempFiles) {
          analysisFiles.forEach((f) => {
            if (fs.existsSync(f.path))
              try {
                fs.unlinkSync(f.path);
              } catch {}
          });
        }

        if (settings.slicer?.estimatedTimeSeconds) {
          await this.projectsRepository.update(project.id, {
            print_time_seconds: settings.slicer.estimatedTimeSeconds,
          });
        }

        return { metadata, shouldDelete: true };
      }
    } catch (e) {
      console.error('GCode analysis failed', e);
    }

    return { metadata: null, shouldDelete: false };
  }
  async removeFile(projectId: number, fileId: number, user: any) {
    const project = await this.findOne(projectId, user);
    const file = await this.projectFilesRepository.findOne({
      where: { id: fileId, project: { id: project.id } },
    });

    if (!file) throw new NotFoundException(`File #${fileId} not found`);

    // Ideally we should also delete the actual file from disk here
    // if (file.file_url) { ... }

    return this.projectFilesRepository.remove(file);
  }
  async exportProjectReport(
    projectId: number,
    user: any,
    lang: string = 'en',
  ): Promise<Buffer> {
    const project = await this.findOne(projectId, user);

    // Fetch full requesting user details
    const requestUser = await this.userRepository.findOne({
      where: { id: user.userId },
    });
    const createdByName = requestUser
      ? requestUser.firstName && requestUser.lastName
        ? `${requestUser.firstName} ${requestUser.lastName}`
        : requestUser.username
      : user.username || 'Unknown';

    // --- Localization Dictionary ---
    const t = (key: string) => {
      const dict: any = {
        en: {
          reportTitle: 'Project Cost Report',
          generatedOn: 'Generated on',
          projectDetails: 'Project Details',
          status: 'Status',
          createdBy: 'Created By',
          dates: 'Dates',
          financialSummary: 'Financial Summary',
          totalCost: 'TOTAL COST',
          targetPrice: 'Target Price',
          margin: 'Margin',
          costBreakdown: 'Cost Breakdown',
          machineCost: 'Machine Cost',
          laborCost: 'Labor Cost',
          materialCost: 'Material Cost',
          miscCost: 'Misc Costs',
          materialUsage: 'Material Usage Summary',
          colBrand: 'Brand',
          colType: 'Type',
          colName: 'Name',
          colWeight: 'Weight (g)',
          colCost: 'Cost',
          consumptionDetails: 'Consumption Details',
          colDate: 'Date',
          colAmount: 'Amount',
          colNote: 'Note',
          colUser: 'User',
          unknown: 'Unknown',
          deletedFilament: 'Deleted Filament',
        },
        fr: {
          reportTitle: 'Rapport de Coûts Projet',
          generatedOn: 'Généré le',
          projectDetails: 'Détails du Projet',
          status: 'Statut',
          createdBy: 'Créé par',
          dates: 'Dates',
          financialSummary: 'Résumé Financier',
          totalCost: 'COÛT TOTAL',
          targetPrice: 'Prix de Vente Cible',
          margin: 'Marge',
          costBreakdown: 'Répartition des Coûts',
          machineCost: 'Coût Machine',
          laborCost: "Coût Main d'œuvre",
          materialCost: 'Coût Matière',
          miscCost: 'Frais Divers',
          materialUsage: 'Résumé Matériaux',
          colBrand: 'Marque',
          colType: 'Type',
          colName: 'Nom',
          colWeight: 'Poids (g)',
          colCost: 'Coût',
          consumptionDetails: 'Détail des Consommations',
          colDate: 'Date',
          colAmount: 'Quantité',
          colNote: 'Note',
          colUser: 'Utilisateur',
          unknown: 'Inconnu',
          deletedFilament: 'Filament Supprimé',
        },
      };
      return dict[lang]?.[key] || dict['en'][key] || key;
    };

    // --- Calculations ---
    const printTimeHours = (project.print_time_seconds || 0) / 3600;
    const laborTimeHours = (project.labor_time_seconds || 0) / 3600;

    const machineCost =
      printTimeHours * (Number(project.machine_hourly_rate) || 0);
    const laborCost = laborTimeHours * (Number(project.labor_hourly_rate) || 0);
    const miscCosts = Number(project.misc_costs) || 0;

    let materialCost = 0;
    // Group by filament for specific table
    const filamentUsage: Record<
      number,
      { filament: any | null; weight: number; cost: number }
    > = {};

    if (project.consumptionLogs) {
      project.consumptionLogs.forEach((log) => {
        const filId = log.filament?.id || 0;
        const pricePerG =
          (log.filament?.price || 0) / (log.filament?.weightInitial || 1000);
        const cost = log.amount * pricePerG;
        materialCost += cost;

        if (!filamentUsage[filId]) {
          filamentUsage[filId] = {
            filament: log.filament || null,
            weight: 0,
            cost: 0,
          };
        }
        filamentUsage[filId].weight += log.amount;
        filamentUsage[filId].cost += cost;
      });
    }

    const totalCost = machineCost + laborCost + miscCosts + materialCost;
    const margin = (Number(project.target_selling_price) || 0) - totalCost;
    const marginPercent = totalCost > 0 ? (margin / totalCost) * 100 : 0; // Markup? Or Margin (margin/price)? User usually means profit.

    // --- Generate Excel ---
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Spooly';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Report');

    // --- Logo Integration ---
    try {
      const fs = require('fs');
      const path = require('path');

      // Default Spooly Logo
      let logoPath = path.resolve(
        '../web/public/logo/logo-horizontal-light.png',
      );
      let isCustom = false;

      // Check if Organization has a logo
      if (project.organization?.logo) {
        // Determine absolute path for uploaded logo
        // project.organization.logo is like '/uploads/logos/xyz.png'
        // We need to map this to the file system path.
        // Assuming api is running in apps/api (or dist/apps/api), and web public is in apps/web/public

        // If path starts with /, remove it to join
        const relativePath = project.organization.logo.startsWith('/')
          ? project.organization.logo.substring(1)
          : project.organization.logo;
        const customLogoPath = path.resolve(`../web/public/${relativePath}`);

        if (fs.existsSync(customLogoPath)) {
          logoPath = customLogoPath;
          isCustom = true;
        }
      }

      if (fs.existsSync(logoPath)) {
        // Get extension without dot
        let ext = path.extname(logoPath).substring(1).toLowerCase();

        // Map jpg to jpeg for exceljs
        if (ext === 'jpg') ext = 'jpeg';

        // ExcelJS only supports png, jpeg, gif
        if (['png', 'jpeg', 'gif'].includes(ext)) {
          const logoId = workbook.addImage({
            buffer: fs.readFileSync(logoPath),
            extension: ext,
          });

          // Adjust dimensions for custom logo if needed, or keep standard box
          sheet.addImage(logoId, {
            tl: { col: 0, row: 1 },
            ext: { width: 220, height: 45 },
          });
        } else {
          console.warn(`Unsupported logo format: ${ext}`);
        }
      }
    } catch (e) {
      console.warn('Could not add logo to report', e);
    }

    // --- Layout & Styling Helpers ---
    const titleFont = {
      name: 'Arial',
      size: 16,
      bold: true,
      color: { argb: 'FF333333' },
    };
    const headerFont = {
      name: 'Arial',
      size: 12,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    const headerFill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' },
    }; // Indigo-600 like
    const borderStyle = { style: 'thin', color: { argb: 'FFCCCCCC' } };
    const currencyFmt = '#,##0.00 "€"';
    const center = { vertical: 'middle', horizontal: 'center' };

    // --- Header Section ---
    sheet.mergeCells('C2:F3'); // Title area
    const titleCell = sheet.getCell('C2');
    titleCell.value = t('reportTitle').toUpperCase();
    titleCell.font = titleFont;
    titleCell.alignment = { vertical: 'middle', horizontal: 'right' };

    sheet.getCell('F4').value =
      `${t('generatedOn')} ${new Date().toLocaleDateString()}`;
    sheet.getCell('F4').alignment = { horizontal: 'right' };

    let currentRow = 6;

    // --- 1. Project Details & Financials (Side by Side) ---

    // Left: Project Info
    sheet.getCell(`A${currentRow}`).value = t('projectDetails');
    sheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };

    sheet.getCell(`D${currentRow}`).value = t('financialSummary');
    sheet.getCell(`D${currentRow}`).font = { bold: true, size: 12 };

    currentRow++;

    // Row 1
    sheet.getCell(`A${currentRow}`).value = t('colName');
    sheet.getCell(`B${currentRow}`).value = project.name;
    sheet.getCell(`B${currentRow}`).font = { bold: true };

    sheet.getCell(`D${currentRow}`).value = t('totalCost');
    sheet.getCell(`E${currentRow}`).value = totalCost;
    sheet.getCell(`E${currentRow}`).numFmt = currencyFmt;
    sheet.getCell(`E${currentRow}`).font = { bold: true, size: 11 };

    currentRow++;

    // Row 2
    sheet.getCell(`A${currentRow}`).value = t('status');
    sheet.getCell(`B${currentRow}`).value = project.status;

    sheet.getCell(`D${currentRow}`).value = t('targetPrice');
    sheet.getCell(`E${currentRow}`).value =
      Number(project.target_selling_price) || 0;
    sheet.getCell(`E${currentRow}`).numFmt = currencyFmt;

    currentRow++;

    // Row 3
    sheet.getCell(`A${currentRow}`).value = t('createdBy');
    sheet.getCell(`B${currentRow}`).value = createdByName;

    sheet.getCell(`D${currentRow}`).value = t('margin');
    sheet.getCell(`E${currentRow}`).value = margin;
    sheet.getCell(`E${currentRow}`).numFmt = currencyFmt;
    sheet.getCell(`E${currentRow}`).font = {
      color: { argb: margin >= 0 ? 'FF008000' : 'FFFF0000' },
    };

    currentRow += 2;

    // --- 2. Cost Breakdown (Bar chart style list) ---
    sheet.getCell(`A${currentRow}`).value = t('costBreakdown');
    sheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
    currentRow++;

    const costs = [
      { label: t('machineCost'), value: machineCost },
      { label: t('laborCost'), value: laborCost },
      { label: t('materialCost'), value: materialCost },
      { label: t('miscCost'), value: miscCosts },
    ];

    costs.forEach((c) => {
      sheet.getCell(`A${currentRow}`).value = c.label;
      sheet.getCell(`B${currentRow}`).value = c.value;
      sheet.getCell(`B${currentRow}`).numFmt = currencyFmt;
      currentRow++;
    });

    currentRow += 2;

    // --- 3. Material Usage Summary ---
    sheet.getCell(`A${currentRow}`).value = t('materialUsage');
    sheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
    currentRow++;

    // Table Header
    const matHeader = [
      t('colBrand'),
      t('colType'),
      t('colName'),
      t('colWeight'),
      t('colCost'),
    ];
    matHeader.forEach((h, i) => {
      const cell = sheet.getCell(currentRow, i + 1);
      cell.value = h;
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { horizontal: 'center' };
    });
    currentRow++;

    Object.values(filamentUsage).forEach((item) => {
      const f = item.filament;
      const name = f ? `${f.colorName || f.color}` : t('deletedFilament');

      sheet.getCell(currentRow, 1).value = f?.brand?.name || t('unknown');
      sheet.getCell(currentRow, 2).value =
        f?.types?.map((t: any) => t.name).join(', ') || '-';
      sheet.getCell(currentRow, 3).value = name;
      sheet.getCell(currentRow, 4).value = item.weight;
      sheet.getCell(currentRow, 4).numFmt = '0.00 "g"';
      sheet.getCell(currentRow, 5).value = item.cost;
      sheet.getCell(currentRow, 5).numFmt = currencyFmt;

      // Borders
      for (let i = 1; i <= 5; i++)
        sheet.getCell(currentRow, i).border = { bottom: borderStyle };
      currentRow++;
    });

    currentRow += 2;

    // --- 4. Detailed Logs ---
    sheet.getCell(`A${currentRow}`).value = t('consumptionDetails');
    sheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
    currentRow++;

    const logHeader = [
      t('colDate'),
      t('colName'),
      t('colAmount'),
      t('colCost'),
      t('colNote'),
    ];
    logHeader.forEach((h, i) => {
      const cell = sheet.getCell(currentRow, i + 1);
      cell.value = h;
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { horizontal: 'center' };
    });
    currentRow++;

    if (project.consumptionLogs) {
      project.consumptionLogs
        .sort(
          (a: any, b: any) =>
            new Date(b.date).getTime() - new Date(a.date).getTime(),
        )
        .forEach((log) => {
          const f = log.filament;
          const pricePerG = (f?.price || 0) / (f?.weightInitial || 1000);
          const cost = log.amount * pricePerG;

          sheet.getCell(currentRow, 1).value = new Date(
            log.date,
          ).toLocaleDateString();
          sheet.getCell(currentRow, 2).value = f
            ? `${f.brand?.name} ${f.types?.map((t: any) => t.name).join(', ')} ${f.colorName}`
            : t('deletedFilament');
          sheet.getCell(currentRow, 3).value = log.amount;
          sheet.getCell(currentRow, 3).numFmt = '0.00 "g"';
          sheet.getCell(currentRow, 4).value = cost;
          sheet.getCell(currentRow, 4).numFmt = currencyFmt;
          sheet.getCell(currentRow, 5).value = log.notes || '-';

          for (let i = 1; i <= 5; i++)
            sheet.getCell(currentRow, i).border = { bottom: borderStyle };
          currentRow++;
        });
    }

    // --- Column Widths ---
    sheet.getColumn(1).width = 25;
    sheet.getColumn(2).width = 20;
    sheet.getColumn(3).width = 35;
    sheet.getColumn(4).width = 15;
    sheet.getColumn(5).width = 15;
    sheet.getColumn(6).width = 20;

    return await workbook.xlsx.writeBuffer();
  }

  async checkFeasibility(projectId: number, user: any) {
    // Check Pro/Trial Status
    const org = await this.organizationRepository.findOne({
      where: { id: user.organizationId },
    });
    const now = new Date();
    const isPro =
      isSelfHosted() ||
      (org &&
      (org.plan === 'pro' ||
        org.plan === 'enterprise' ||
        org.plan === 'beta' ||
        (org.trialEndsAt && new Date(org.trialEndsAt) > now)));

    if (!isPro) {
      // Return RESTRICTED status instead of 403 to allow UI upsell
      return {
        projectId,
        overallStatus: 'RESTRICTED',
        items: [],
      };
    }

    const project = await this.findOne(projectId, user);

    const report: any[] = [];
    let overallStatus: 'OK' | 'RISK' | 'CRITICAL' = 'OK';

    for (const item of project.items) {
      const required = item.weight_required_g || 0;
      const used = item.weight_used_g || 0;
      const remainingNeeded = Math.max(0, required - used);

      // If project is completed or item fully printed, no risk
      if (remainingNeeded <= 0) {
        report.push({
          itemId: item.id,
          name: item.filament
            ? `${item.filament.brand?.name} ${item.filament.colorName}`
            : `${item.material} ${item.color}`,
          status: 'OK',
          message: 'Completed',
          stockAvailable: 0,
          remainingNeeded: 0,
        });
        continue;
      }

      let stockAvailable = 0;
      let filamentNames: string[] = [];

      // Case A: Specific Filament Assigned
      if (item.filament) {
        // Re-fetch to get latest weight
        const f = await this.filamentRepository.findOne({
          where: { id: item.filament.id },
        });
        if (f) {
          stockAvailable = f.weightRemaining;
          filamentNames.push(
            `${f.brand?.name} ${f.colorName} (${f.nfcTagId ? 'NFC' : 'Manual'})`,
          );
        }
      }
      // Case B: Generic Requirement (Material + Color)
      else if (item.material && item.color) {
        // Find all matching filaments in Organization
        // We need to join relations to filter by material name and color
        // This is a bit complex with current entity structure if material is a relation in Filament

        // Assuming item.material is a string name, but Filament has Material Entity.
        // We should match Filament.material.name OR Filament.material (if string? no it is entity)
        // And Filament.color or Filament.colorName

        const filaments = await this.filamentRepository.find({
          where: {
            organization: { id: user.organizationId },
          },
          relations: ['material', 'brand'],
        });

        // Filter in memory for flexibility (fuzzy match?)
        const matches = filaments.filter((f) => {
          const matMatch = f.material?.name
            ?.toLowerCase()
            .includes(item.material.toLowerCase());
          const colMatch =
            f.color?.toLowerCase() === item.color.toLowerCase() ||
            f.colorName?.toLowerCase().includes(item.color.toLowerCase());
          return matMatch && colMatch;
        });

        stockAvailable = matches.reduce((sum, f) => sum + f.weightRemaining, 0);
        filamentNames = matches.map((f) => `${f.brand?.name} ${f.colorName}`);
      }

      // Determine Status
      let status: 'OK' | 'RISK' | 'CRITICAL' = 'OK';
      let message = '';

      if (stockAvailable < remainingNeeded) {
        status = 'CRITICAL';
        overallStatus = 'CRITICAL';
        message = `Missing ${Math.round(remainingNeeded - stockAvailable)}g`;
      } else if (stockAvailable < remainingNeeded * 1.2) {
        // Less than 20% buffer
        status = 'RISK';
        if (overallStatus !== 'CRITICAL') overallStatus = 'RISK';
        message = `Low Stock (Buffer < 20%)`;
      } else {
        status = 'OK';
        message = 'Sufficient Stock';
      }

      report.push({
        itemId: item.id,
        name: item.filament
          ? `${item.filament.brand?.name} ${item.filament.colorName ?? item.filament.color}`
          : `${item.material} ${item.color}`,
        formattedName: item.filament
          ? `${item.filament.brand?.name} - ${item.filament.colorName ?? item.filament.color}`
          : `${item.material} - ${item.color}`,
        status,
        message,
        stockAvailable,
        remainingNeeded,
        potentialFilaments: filamentNames,
      });
    }

    return {
      projectId: project.id,
      overallStatus,
      items: report,
    };
  }
}
