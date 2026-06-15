jest.mock('marked', () => ({ marked: jest.fn((value: string) => value) }));

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiAlertService } from './ai-alert.service';
import { AiAlertState } from './ai-alert-state.entity';
import { AiAgentService } from './ai-agent.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.entity';
import { Organization } from '../organization/organization.entity';
import { UserOrganization } from '../organization/user-organization.entity';
import { UserNotificationPreference } from '../notification/user-notification-preference.entity';

const ALERT = {
  type: 'rupture',
  alert_key: 'rupture:fil-1',
  severity: 'critical',
  title: 'Rupture imminente : PLA noir',
  message: 'Bientot vide.',
  data: { item_id: 'fil-1' },
};

describe('AiAlertService', () => {
  let service: AiAlertService;
  let notif: { create: jest.Mock };
  let stateRepo: any;
  let userOrgRepo: { find: jest.Mock };
  let orgRepo: { find: jest.Mock; findOne: jest.Mock };
  let prefRepo: { find: jest.Mock };
  let agent: { getApplicationContext: jest.Mock };

  beforeEach(async () => {
    notif = { create: jest.fn().mockResolvedValue({ id: 1 }) };
    prefRepo = { find: jest.fn().mockResolvedValue([]) }; // aucune pref => tout actif par defaut
    const stateStore: any[] = [];
    stateRepo = {
      _store: stateStore,
      findOne: jest.fn(({ where }) =>
        Promise.resolve(
          stateStore.find(
            (s) => s.organizationId === where.organizationId && s.alertKey === where.alertKey,
          ) || null,
        ),
      ),
      find: jest.fn(({ where }) =>
        Promise.resolve(stateStore.filter((s) => s.organizationId === where.organizationId)),
      ),
      save: jest.fn((row) => {
        const existing = stateStore.find(
          (s) => s.organizationId === row.organizationId && s.alertKey === row.alertKey,
        );
        if (existing) Object.assign(existing, row);
        else stateStore.push({ ...row });
        return Promise.resolve(row);
      }),
      remove: jest.fn((rows) => {
        for (const r of rows) {
          const i = stateStore.indexOf(r);
          if (i >= 0) stateStore.splice(i, 1);
        }
        return Promise.resolve(rows);
      }),
      create: jest.fn((row) => row),
    };
    userOrgRepo = {
      find: jest.fn().mockResolvedValue([{ userId: 7, role: 'owner', hasConfirmed: true }]),
    };
    orgRepo = {
      find: jest.fn().mockResolvedValue([{ id: 5, plan: 'pro', name: 'Atelier' }]),
      findOne: jest.fn().mockResolvedValue({ id: 5, plan: 'pro', name: 'Atelier' }),
    };
    agent = { getApplicationContext: jest.fn().mockResolvedValue({ filaments: [] }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiAlertService,
        { provide: getRepositoryToken(AiAlertState), useValue: stateRepo },
        { provide: getRepositoryToken(Organization), useValue: orgRepo },
        { provide: getRepositoryToken(UserOrganization), useValue: userOrgRepo },
        { provide: getRepositoryToken(UserNotificationPreference), useValue: prefRepo },
        { provide: AiAgentService, useValue: agent },
        { provide: NotificationService, useValue: notif },
      ],
    }).compile();
    service = module.get(AiAlertService);
    // Stub du fetch moteur
    jest.spyOn(service as any, 'fetchAlerts').mockResolvedValue([{ ...ALERT }]);
  });

  it('envoie une alerte neuve aux admins/owners avec le nom de l org en prefixe', async () => {
    await service.scanOrganization(5);
    expect(notif.create).toHaveBeenCalledWith(
      7,
      NotificationType.AI_ALERT,
      `[Atelier] ${ALERT.title}`,
      ALERT.message,
      { ...ALERT.data, organizationId: 5, organizationName: 'Atelier' },
    );
  });

  it('ne notifie pas un membre ayant coupe les alertes IA pour cette org', async () => {
    userOrgRepo.find.mockResolvedValue([
      { userId: 7, role: 'owner', hasConfirmed: true, notifyOnAiAlerts: false },
    ]);
    await service.scanOrganization(5);
    expect(notif.create).not.toHaveBeenCalled();
  });

  it('ne notifie pas un destinataire ayant desactive le sous-type', async () => {
    prefRepo.find.mockResolvedValue([
      { userId: 7, notifyOnAiRupture: false, notifyOnAiAchat: true, notifyOnAiProjet: true },
    ]);
    await service.scanOrganization(5); // ALERT est de type "rupture", desactive pour l'utilisateur 7
    expect(notif.create).not.toHaveBeenCalled();
  });

  it('ne renvoie pas la meme alerte avant le cooldown', async () => {
    await service.scanOrganization(5);
    notif.create.mockClear();
    await service.scanOrganization(5);
    expect(notif.create).not.toHaveBeenCalled();
  });

  it('renvoie si la severite escalade', async () => {
    (service as any).fetchAlerts.mockResolvedValueOnce([{ ...ALERT, severity: 'high' }]);
    await service.scanOrganization(5);
    notif.create.mockClear();
    (service as any).fetchAlerts.mockResolvedValueOnce([{ ...ALERT, severity: 'critical' }]);
    await service.scanOrganization(5);
    expect(notif.create).toHaveBeenCalledTimes(1);
  });

  it('purge l etat quand l alerte disparait (rearmement)', async () => {
    await service.scanOrganization(5);
    (service as any).fetchAlerts.mockResolvedValueOnce([]);
    await service.scanOrganization(5);
    expect(stateRepo._store.length).toBe(0);
  });

  it('org Free: ne recoit pas les alertes Pro (rupture)', async () => {
    orgRepo.findOne.mockResolvedValueOnce({ id: 5, plan: 'free' });
    // fetchAlerts (stub) renvoie une alerte rupture -> doit etre filtree pour le Free
    await service.scanOrganization(5);
    expect(notif.create).not.toHaveBeenCalled();
  });

  it('org Free: recoit les alertes projet', async () => {
    orgRepo.findOne.mockResolvedValueOnce({ id: 5, plan: 'free', name: 'Atelier' });
    (service as any).fetchAlerts.mockResolvedValueOnce([
      {
        type: 'projet',
        alert_key: 'projet:p1',
        severity: 'high',
        title: 'Projet a risque : Support',
        message: 'Stock insuffisant.',
        data: { project_id: 'p1' },
      },
    ]);
    await service.scanOrganization(5);
    expect(notif.create).toHaveBeenCalledWith(
      7,
      NotificationType.AI_ALERT,
      '[Atelier] Projet a risque : Support',
      'Stock insuffisant.',
      { project_id: 'p1', organizationId: 5, organizationName: 'Atelier' },
    );
  });

  it('runScheduledScan ignore les orgs non eligibles', async () => {
    orgRepo.find.mockResolvedValueOnce([]); // aucune org elevee
    const spy = jest.spyOn(service, 'scanOrganization');
    await service.runScheduledScan();
    expect(spy).not.toHaveBeenCalled();
  });
});
