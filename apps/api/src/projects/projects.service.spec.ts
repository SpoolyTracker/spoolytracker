import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProjectsService } from './projects.service';
import { Project } from './entities/project.entity';
import { ProjectItem } from './entities/project-item.entity';
import { ProjectExternalItem } from './entities/project-external-item.entity';
import { ProjectFile } from './entities/project-file.entity';
import { Filament } from '../filament/filament.entity';
import { ConsumptionLog } from '../filament/consumption-log.entity';
import { Organization } from '../organization/organization.entity';
import { User } from '../auth/user.entity';
import { GcodeAnalyzerService } from '../gcode/gcode-analyzer.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let projectsRepo: any;

  const mockRepository = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    remove: jest.fn(),
    merge: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: getRepositoryToken(Project), useFactory: mockRepository },
        { provide: getRepositoryToken(ProjectItem), useFactory: mockRepository },
        { provide: getRepositoryToken(ProjectExternalItem), useFactory: mockRepository },
        { provide: getRepositoryToken(ProjectFile), useFactory: mockRepository },
        { provide: getRepositoryToken(Filament), useFactory: mockRepository },
        {
          provide: getRepositoryToken(ConsumptionLog),
          useFactory: mockRepository,
        },
        {
          provide: getRepositoryToken(Organization),
          useFactory: mockRepository,
        },
        { provide: getRepositoryToken(User), useFactory: mockRepository },
        { provide: GcodeAnalyzerService, useValue: {} },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    projectsRepo = module.get(getRepositoryToken(Project));
  });

  describe('findAll', () => {
    // Regression: the AI context (/ai/context) builds project requirements from
    // project.items and resolves material/color via item.filament. If findAll
    // does not eager-load the filament relation, requirements collapse to
    // "Inconnu/Inconnu" and the AI flags healthy projects as at-risk.
    it('eager-loads the item filament relation so requirements keep their identity', async () => {
      projectsRepo.find.mockResolvedValue([]);

      await service.findAll({ organizationId: 1 });

      const { relations } = projectsRepo.find.mock.calls[0][0];
      expect(relations).toEqual(
        expect.arrayContaining([
          'items',
          'items.filament',
          'items.filament.material',
        ]),
      );
    });
  });
});
