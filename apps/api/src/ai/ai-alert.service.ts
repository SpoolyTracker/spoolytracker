import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AiAlertState } from './ai-alert-state.entity';
import { AiAgentService } from './ai-agent.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.entity';
import { Organization } from '../organization/organization.entity';
import { UserOrganization } from '../organization/user-organization.entity';
import { UserNotificationPreference } from '../notification/user-notification-preference.entity';
import { ELEVATED_PLANS } from '../common/persistent-intelligence';

interface EngineAlert {
  type: string;
  alert_key: string;
  severity: string;
  title: string;
  message: string;
  data: Record<string, any>;
}

// Delai anti-repetition par defaut (heures). Reglable par org via
// org.settings.aiAlertCooldownHours, sinon via l'env, sinon 72h.
const DEFAULT_COOLDOWN_HOURS = Number(process.env.AI_ALERT_COOLDOWN_HOURS) || 72;
const SEVERITY_RANK: Record<string, number> = { medium: 1, high: 2, critical: 3 };

// Palier des alertes proactives :
// - Free : "projet a risque" (calcul deterministe simple, donne de la valeur au Free).
// - Pro/Entreprise/Beta : tout (rupture imminente + achat recommande = anticipation premium).
const ALL_ALERT_TYPES = ['rupture', 'achat', 'projet'];
const FREE_ALERT_TYPES = ['projet'];

@Injectable()
export class AiAlertService {
  private readonly logger = new Logger(AiAlertService.name);

  constructor(
    @InjectRepository(AiAlertState)
    private readonly stateRepo: Repository<AiAlertState>,
    @InjectRepository(Organization)
    private readonly organizationRepo: Repository<Organization>,
    @InjectRepository(UserOrganization)
    private readonly userOrgRepo: Repository<UserOrganization>,
    @InjectRepository(UserNotificationPreference)
    private readonly prefRepo: Repository<UserNotificationPreference>,
    private readonly aiAgentService: AiAgentService,
    private readonly notificationService: NotificationService,
  ) {}

  async runScheduledScan(): Promise<void> {
    const orgs = await this.organizationRepo.find({ where: { plan: In(ELEVATED_PLANS) } });
    this.logger.log(`Scan alertes IA: ${orgs.length} organisation(s) eligible(s).`);
    for (const org of orgs) {
      await this.scanOrganization(org.id).catch((error) =>
        this.logger.error(`Scan alertes echoue pour org ${org.id}`, error),
      );
    }
  }

  async scanOrganization(organizationId: number, filamentId?: string): Promise<void> {
    // Palier par plan: le Free ne recoit que les types "Free", le Pro recoit tout.
    const org = await this.organizationRepo.findOne({ where: { id: organizationId } });
    if (!org) return;
    const allowedTypes = ELEVATED_PLANS.includes(org.plan)
      ? ALL_ALERT_TYPES
      : FREE_ALERT_TYPES;
    if (allowedTypes.length === 0) return;

    const ownerId = await this.firstRecipientId(organizationId);
    const synthUser = {
      organizationId,
      userId: ownerId,
      isSuperAdmin: false,
      systemRole: 'admin',
    };
    const snapshot = await this.aiAgentService
      .getApplicationContext(synthUser)
      .catch(() => null);

    // On demande au moteur uniquement les types autorises, et on re-filtre
    // defensivement cote API pour garantir le palier.
    let alerts = (await this.fetchAlerts(organizationId, snapshot, allowedTypes)).filter(
      (a) => allowedTypes.includes(a.type),
    );
    if (filamentId) {
      alerts = alerts.filter((a) => a.data?.item_id === filamentId);
    }
    const cooldownHours =
      Number((org.settings as any)?.aiAlertCooldownHours) || DEFAULT_COOLDOWN_HOURS;
    await this.dispatchAlerts(organizationId, alerts, org.name, cooldownHours, filamentId);
  }

  async checkAfterConsumption(organizationId: number, filamentId: number): Promise<void> {
    await this.scanOrganization(organizationId, String(filamentId));
  }

  private async fetchAlerts(
    organizationId: number,
    snapshot: any,
    types: string[],
  ): Promise<EngineAlert[]> {
    const engineUrl = (process.env.AI_ENGINE_URL || 'http://localhost:8000').replace(/\/$/, '');
    try {
      const response = await fetch(`${engineUrl}/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': String(organizationId),
          'x-organization-id': String(organizationId),
          'x-user-id': String(organizationId),
          'x-plan': 'pro',
        },
        body: JSON.stringify({ snapshot, types }),
      });
      if (!response.ok) return [];
      const payload = await response.json();
      return Array.isArray(payload?.alerts) ? payload.alerts : [];
    } catch (error) {
      this.logger.warn(
        `Moteur alertes indisponible (org ${organizationId}): ${error instanceof Error ? error.message : error}`,
      );
      return [];
    }
  }

  private async dispatchAlerts(
    organizationId: number,
    alerts: EngineAlert[],
    organizationName: string | undefined,
    cooldownHours: number,
    filamentId?: string,
  ): Promise<void> {
    const recipients = await this.recipientIds(organizationId);
    const prefs = await this.loadPreferences(recipients);
    for (const alert of alerts) {
      if (!(await this.shouldSend(organizationId, alert, cooldownHours))) continue;
      // Le nom de l'org est prefixe au titre pour lever toute ambiguite quand
      // l'utilisateur gere plusieurs organisations.
      const title = organizationName ? `[${organizationName}] ${alert.title}` : alert.title;
      const data = { ...alert.data, organizationId, organizationName };
      for (const userId of recipients) {
        if (!this.prefAllows(prefs.get(userId), alert.type)) continue;
        await this.notificationService
          .create(userId, NotificationType.AI_ALERT, title, alert.message, data)
          .catch((error) =>
            this.logger.error(`Echec envoi alerte IA a l'utilisateur ${userId}`, error),
          );
      }
    }
    // Réarmement: ne purge l'état obsolète que lors d'un scan complet (pas un check ciblé).
    if (!filamentId) {
      await this.purgeResolved(organizationId, alerts);
    }
  }

  private async shouldSend(
    organizationId: number,
    alert: EngineAlert,
    cooldownHours: number,
  ): Promise<boolean> {
    const existing = await this.stateRepo.findOne({
      where: { organizationId, alertKey: alert.alert_key },
    });
    const now = Date.now();
    const escalated =
      existing && (SEVERITY_RANK[alert.severity] || 0) > (SEVERITY_RANK[existing.severity] || 0);
    const cooledDown =
      existing && now - new Date(existing.lastSentAt).getTime() > cooldownHours * 3600 * 1000;

    if (existing && !escalated && !cooledDown) return false;

    const row = existing || this.stateRepo.create({ organizationId, alertKey: alert.alert_key });
    row.severity = alert.severity;
    row.lastSentAt = new Date();
    await this.stateRepo.save(row);
    return true;
  }

  private async purgeResolved(organizationId: number, alerts: EngineAlert[]): Promise<void> {
    const activeKeys = new Set(alerts.map((a) => a.alert_key));
    const states = await this.stateRepo.find({ where: { organizationId } });
    const stale = states.filter((s) => !activeKeys.has(s.alertKey));
    if (stale.length > 0) await this.stateRepo.remove(stale);
  }

  private async recipientIds(organizationId: number): Promise<number[]> {
    const memberships = await this.userOrgRepo.find({
      where: [
        { organizationId, role: 'admin', hasConfirmed: true },
        { organizationId, role: 'owner', hasConfirmed: true },
      ],
    });
    // Exclut les membres ayant coupe les alertes IA pour cette organisation.
    return [
      ...new Set(
        memberships.filter((m) => m.notifyOnAiAlerts !== false).map((m) => m.userId),
      ),
    ];
  }

  private async firstRecipientId(organizationId: number): Promise<number | undefined> {
    const ids = await this.recipientIds(organizationId);
    return ids[0];
  }

  private async loadPreferences(
    userIds: number[],
  ): Promise<Map<number, UserNotificationPreference>> {
    if (userIds.length === 0) return new Map();
    const rows = await this.prefRepo.find({ where: { userId: In(userIds) } });
    return new Map(rows.map((row) => [row.userId, row]));
  }

  private prefAllows(pref: UserNotificationPreference | undefined, type: string): boolean {
    if (!pref) return true; // pas de preference enregistree => tout actif par defaut
    if (type === 'rupture') return pref.notifyOnAiRupture ?? true;
    if (type === 'achat') return pref.notifyOnAiAchat ?? true;
    if (type === 'projet') return pref.notifyOnAiProjet ?? true;
    return true;
  }
}
