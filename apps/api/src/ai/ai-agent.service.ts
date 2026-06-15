import { Injectable } from '@nestjs/common';
import { FilamentService } from '../filament/filament.service';
import { ProjectsService } from '../projects/projects.service';
import { EmailService } from '../email/email.service';
import { AiActionPersistenceService } from './ai-action.service';
import { AiActionType } from './ai-action.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { FilamentBrand } from '../filament/brand.entity';
import { FilamentMaterial } from '../filament/filament-material.entity';
import { FilamentType } from '../filament/filament-type.entity';
import { Filament } from '../filament/filament.entity';
import { Organization } from '../organization/organization.entity';
import { AiMemoryService } from './ai-memory.service';
import { hasPersistentIntelligence } from '../common/persistent-intelligence';

export interface AgentResponse {
  intent: string;
  answer: string;
  data?: any;
  isError?: boolean;
}

export interface RackOcrResult {
  status: 'needs_vision_model' | 'processed';
  spoolCount: number | null;
  colors: Array<{ hex: string; count?: number; confidence?: number }>;
  confidence: number;
  notes: string;
  image: {
    filename: string;
    mimeType: string;
    size: number;
  };
}

type AiContextUser = {
  organizationId: number;
  userId?: number;
  sub?: number;
  isSuperAdmin?: boolean;
  systemRole?: string;
};

@Injectable()
export class AiAgentService {
  constructor(
    private readonly filamentService: FilamentService,
    private readonly projectsService: ProjectsService,
    private readonly emailService: EmailService,
    @InjectRepository(FilamentBrand)
    private brandRepository: Repository<FilamentBrand>,
    @InjectRepository(FilamentMaterial)
    private materialRepository: Repository<FilamentMaterial>,
    @InjectRepository(FilamentType)
    private typeRepository: Repository<FilamentType>,
    @InjectRepository(Filament)
    private filamentRepository: Repository<Filament>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    private readonly aiActionService: AiActionPersistenceService,
    private readonly aiMemoryService: AiMemoryService,
  ) {}

  async processQuestion(
    question: string,
    user: any,
    ip: string = '',
    authorization?: string,
  ): Promise<AgentResponse> {
    const engineResponse = await this.askAiEngine(question, user, authorization);
    if (engineResponse) {
      const plan = await this.resolveOrgPlan(user.organizationId);
      const eligible = hasPersistentIntelligence(plan, user);

      // Mémoire capturée (gated)
      const captured = engineResponse.data?.captured_memory;
      if (captured && captured.content && eligible) {
        await this.aiMemoryService
          .persistCaptured(captured, {
            organizationId: user.organizationId,
            userId: Number(user.userId || user.sub),
          })
          .catch((error) => {
            console.error(
              'Echec persistance mémoire IA:',
              error instanceof Error ? error.message : error,
            );
          });
      }

      const proposed = engineResponse.data?.proposedActions || [];
      if (Array.isArray(proposed) && proposed.length > 0) {
        try {
          const persisted = await this.aiActionService.persistProposals(
            proposed
              .filter((a: any) => a && a.type)
              .map((a: any) => ({
                type: a.type as AiActionType,
                label: a.label || a.title || a.type,
                payload: a.payload || {},
              })),
            { organizationId: user.organizationId, userId: user.userId || user.sub },
          );
          engineResponse.data = { ...engineResponse.data, actions: persisted };
        } catch (error) {
          console.error(
            'Failed to persist AI proposals:',
            error instanceof Error ? error.message : error,
          );
        }
      }

      engineResponse.data = { ...engineResponse.data, persistentIntelligence: eligible, aiTier: eligible ? 'pro' : 'free' };
      return engineResponse;
    }

    const q = question.toLowerCase();

    // 1. Detect Intent
    const intent = this.detectIntent(q);

    // 2. Fetch Data & Format Response
    switch (intent) {
      case 'help':
        return this.handleHelp();
      case 'stock_overview':
        return this.handleStockOverview(user, q);
      case 'low_stock':
        return this.handleLowStock(user);
      case 'depletion_forecast':
        return this.handleDepletionForecast(user);
      case 'total_consumption':
        return this.handleTotalConsumption(user);
      case 'consumption_month':
        return this.handleConsumptionMonth(user);
      case 'most_used':
        return this.handleMostUsed(user);
      case 'project_status':
        return this.handleProjectStatus(user);
      case 'financial_stats':
        return this.handleFinancialStats(user);
      case 'feasible_projects':
        return this.handleFeasibleProjects(user);
      case 'feedback':
        return this.handleFeedback(user, question, ip);
      case 'create_filament':
        return this.handleCreateFilament(user, question);
      case 'create_consumption':
        return this.handleCreateConsumption(user, question);
      default:
        return {
          intent: 'unknown',
          answer:
            'Je ne suis pas sûr de comprendre. Demandez-moi **"Que sais-tu faire ?"** pour voir mes commandes.\n\n*I\'m not sure I understand. Ask me **"What can you do?"** to see my commands.*',
        };
    }
  }

  async isPersistentIntelligenceEnabled(organizationId: number, user: any): Promise<boolean> {
    return hasPersistentIntelligence(await this.resolveOrgPlan(organizationId), user);
  }

  async checkEngineStatus(
    user: AiContextUser,
    authorization?: string,
  ): Promise<{ available: boolean; dataSource?: string }> {
    const engineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8000';
    const organizationId = user.organizationId;
    const userId = user.userId || user.sub;
    if (!engineUrl || !organizationId || !userId) return { available: false };
    try {
      const plan = await this.resolveOrgPlan(organizationId);
      const effectivePlan = hasPersistentIntelligence(plan, user) ? 'pro' : plan;
      const headers: Record<string, string> = {
        'x-workspace-id': String(organizationId),
        'x-organization-id': String(organizationId),
        'x-user-id': String(userId),
        'x-plan': effectivePlan,
      };
      if (authorization) headers.Authorization = authorization;
      const res = await fetch(`${engineUrl.replace(/\/$/, '')}/status`, { headers });
      if (!res.ok) return { available: false };
      const body = await res.json().catch(() => ({}));
      return { available: true, dataSource: body?.data_source };
    } catch {
      return { available: false };
    }
  }

  private async resolveOrgPlan(organizationId: number): Promise<string> {
    if (!organizationId) return 'free';
    const org = await this.organizationRepository.findOne({ where: { id: organizationId } });
    return org?.plan || 'free';
  }

  private async askAiEngine(
    question: string,
    user: AiContextUser,
    authorization?: string,
  ): Promise<AgentResponse | null> {
    const engineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8000';
    const organizationId = user.organizationId;
    const userId = user.userId || user.sub;
    if (!engineUrl || !organizationId || !userId) {
      return null;
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-workspace-id': String(organizationId),
        'x-organization-id': String(organizationId),
        'x-user-id': String(userId),
      };
      if (authorization) {
        headers.Authorization = authorization;
      }

      const plan = await this.resolveOrgPlan(organizationId);
      const effectivePlan = hasPersistentIntelligence(plan, user) ? 'pro' : plan;
      headers['x-plan'] = effectivePlan;

      const snapshot = await this.getApplicationContext(user).catch((error) => {
        console.warn(
          'AI snapshot unavailable, engine will use its own fallback:',
          error instanceof Error ? error.message : error,
        );
        return null;
      });
      const response = await fetch(`${engineUrl.replace(/\/$/, '')}/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: question, snapshot }),
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${await response.text()}`);
      }

      const payload = await response.json();
      return {
        intent: payload.intent || 'ai_engine',
        answer: payload.answer || 'Pas de réponse.',
        data: {
          ...(payload.data || {}),
          requiresConfirmation: payload.requires_confirmation || false,
          proposedActions: payload.proposed_actions || [],
          engine: 'ai-engine',
        },
      };
    } catch (error) {
      console.warn(
        'AI Engine chat unavailable, falling back to API agent:',
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }

  async getApplicationContext(user: AiContextUser) {
    const organizationId = user.organizationId;
    const plan = await this.resolveOrgPlan(organizationId);
    const filaments = await this.filamentService.findAll(organizationId);
    const history = await this.filamentService.getAllConsumptionHistory(
      organizationId,
      user.isSuperAdmin || false,
    );
    const projects = await this.projectsService.findAll(user);

    return {
      organization_id: String(organizationId),
      user_id: user.userId || user.sub ? String(user.userId || user.sub) : null,
      settings: {
        organization_id: String(organizationId),
        plan,
        low_stock_threshold: 20,
        low_stock_threshold_type: 'PERCENTAGE',
      },
      filaments: filaments.map((filament: any) => ({
        id: String(filament.id),
        organization_id: String(organizationId),
        name: `${filament.material?.name || 'Filament'} ${filament.colorName || filament.color || ''}`.trim(),
        brand_name: filament.brand?.name || 'Inconnu',
        material_name: filament.material?.name || 'Inconnu',
        color_name: filament.colorName || filament.color || 'Inconnu',
        color_hex: filament.colorHex || filament.color || null,
        color_display_name: filament.colorName || null,
        material_type: Array.isArray(filament.types)
          ? filament.types.map((type: any) => type?.name).filter(Boolean).join(', ') || null
          : filament.type?.name || null,
        weight_initial_g: filament.weightInitial || 0,
        weight_remaining_g: filament.weightRemaining || 0,
        planned_weight_g: filament.plannedWeight || 0,
        virtual_weight_remaining_g: filament.virtualWeightRemaining ?? null,
        low_stock_threshold: filament.lowStockThreshold ?? null,
        low_stock_threshold_type:
          filament.lowStockThresholdType || 'PERCENTAGE',
        price: filament.price ?? null,
        vendor: filament.vendor ?? null,
      })),
      consumptions: (history?.logs || []).map((log: any) => ({
        id: String(log.id),
        organization_id: String(organizationId),
        filament_id: String(log.filamentId || log.filament?.id),
        amount_g: log.amount || 0,
        occurred_on: new Date(log.date).toISOString().slice(0, 10),
        type: log.type || 'PRINT',
        project_id: log.projectId ? String(log.projectId) : null,
        print_status: log.printStatus || null,
        is_planned: Boolean(log.is_planned),
      })),
      projects: projects.map((project: any) => ({
        id: String(project.id),
        organization_id: String(organizationId),
        name: project.name,
        status: project.status,
        requirements: (project.items || []).map((item: any) => ({
          material: item.material || item.filament?.material?.name || 'Inconnu',
          color: item.color || item.filament?.colorName || item.filament?.color || 'Inconnu',
          required_g: item.weight_required_g || 0,
        })),
      })),
      memories:
        hasPersistentIntelligence(plan, user) && (user.userId || user.sub)
          ? await this.aiMemoryService.searchForSnapshot(
              { organizationId, userId: Number(user.userId || user.sub) },
              '',
            )
          : undefined,
    };
  }

  async analyzeRackPhoto(
    file: Express.Multer.File,
    organizationId?: number,
  ): Promise<RackOcrResult> {
    const engineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8000';
    if (!engineUrl) {
      return {
        status: 'needs_vision_model',
        spoolCount: null,
        colors: [],
        confidence: 0,
        notes: 'AI_ENGINE_URL non configurée côté API.',
        image: {
          filename: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        },
      };
    }

    try {
      const formData = new FormData();
      const imageBytes = file.buffer.buffer.slice(
        file.buffer.byteOffset,
        file.buffer.byteOffset + file.buffer.byteLength,
      ) as ArrayBuffer;
      formData.append(
        'image',
        new Blob([imageBytes], { type: file.mimetype }),
        file.originalname,
      );
      if (organizationId) {
        formData.append('organization_id', String(organizationId));
      }

      const response = await fetch(`${engineUrl.replace(/\/$/, '')}/vision/rack-ocr`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${await response.text()}`);
      }

      return (await response.json()) as RackOcrResult;
    } catch (error) {
      return {
        status: 'needs_vision_model',
        spoolCount: null,
        colors: [],
        confidence: 0,
        notes: `AI Engine OCR indisponible: ${error instanceof Error ? error.message : String(error)}`,
        image: {
          filename: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        },
      };
    }
  }

  private detectIntent(q: string): string {
    if (
      q.includes('aide') ||
      q.includes('help') ||
      q.includes('quoi') ||
      q.includes('what') ||
      q.includes('sais-tu faire')
    )
      return 'help';

    if (
      q.includes('prédiction') ||
      q.includes('forecast') ||
      q.includes('quand') ||
      q.includes('vide') ||
      q.includes('run out') ||
      q.includes('épuisé')
    )
      return 'depletion_forecast';

    if (
      q.includes('stock bas') ||
      q.includes('low stock') ||
      q.includes('rupture') ||
      q.includes('manque')
    )
      return 'low_stock';

    if (
      q.includes('stock') ||
      q.includes('inventaire') ||
      q.includes('inventory') ||
      q.includes('bobines') ||
      q.includes('spools')
    )
      return 'stock_overview';

    if (
      q.includes('plus utilisé') ||
      q.includes('most used') ||
      q.includes('top') ||
      q.includes('favori')
    )
      return 'most_used';

    if (
      q.includes('ce mois') ||
      q.includes('this month') ||
      q.includes('mensuel')
    )
      return 'consumption_month';

    if (
      q.includes('consommation') ||
      q.includes('consommé') ||
      q.includes('consumption') ||
      q.includes('used') ||
      q.includes('total')
    )
      return 'total_consumption';

    if (q.includes('projet') || q.includes('project') || q.includes('en cours'))
      return 'project_status';

    if (
      q.includes('feedback') ||
      q.includes('retour') ||
      q.includes('suggestion') ||
      q.includes('amélioration') ||
      q.includes('idée') ||
      q.includes('bug')
    )
      return 'feedback';
    if (
      q.includes('finance') ||
      q.includes('coût') ||
      q.includes('cout') ||
      q.includes('euro') ||
      q.includes('€') ||
      q.includes('prix') ||
      q.includes('dépense') ||
      q.includes('argent')
    )
      return 'financial_stats';
    if (
      q.includes('faisable') ||
      q.includes('possible') ||
      q.includes('suffisant') ||
      q.includes('assez') ||
      q.includes('imprimer quoi')
    )
      return 'feasible_projects';

    if (
      q.match(
        /\b(ajoute|ajout|crée|cree|créer|creer|nouveau|nouvelle|acheter|acheté)\b.*\b(bobine|filament|spool)\b/,
      )
    )
      return 'create_filament';
    // Add a fallback for when the user just says "cree moi un bobine"
    if (
      q.includes('crée') ||
      q.includes('cree') ||
      q.includes('créez') ||
      q.includes('ajout')
    ) {
      if (q.includes('bobine') || q.includes('filament'))
        return 'create_filament';
    }

    if (
      q.match(
        /\b(imprimé|consommé|utilisé|retirer|log|loggue|logue)\b.*\b(\d+)\s*(g|gr|grammes)\b/,
      )
    )
      return 'create_consumption';

    return 'unknown';
  }

  private handleHelp(): AgentResponse {
    return {
      intent: 'help',
      answer: `Voici ce que vous pouvez me demander :\n\n- **Stock** : *"Quel est mon stock ?"*, *"Quelles bobines sont presque vides ?"*, *"Quand vais-je tomber en rupture ?"*\n- **Consommation** : *"Combien ai-je consommé ce mois-ci ?"*, *"Quel est mon filament le plus utilisé ?"*, *"Consommation totale ?"*\n- **Projets** : *"Où en sont mes projets ?"*\n\nSi vous rencontrez un **problème technique** ou avez une **suggestion**, cliquez sur l'icône de bouée (🛟) en haut de l'écran !`,
    };
  }

  private async handleStockOverview(
    user: any,
    question: string = '',
  ): Promise<AgentResponse> {
    const filaments = await this.filamentService.findAll(user.organizationId);
    const activeFilaments = filaments.filter((f) => f.weightRemaining > 0);
    const totalWeight = activeFilaments.reduce(
      (sum, f) => sum + f.weightRemaining,
      0,
    );
    const activeCount = activeFilaments.length;

    const wantsMaterialBreakdown =
      question.includes('matiere') ||
      question.includes('matière') ||
      question.includes('material') ||
      question.includes('materiau') ||
      question.includes('matériau');
    const wantsColorBreakdown =
      question.includes('couleur') ||
      question.includes('color') ||
      question.includes('teinte');

    if (wantsMaterialBreakdown || wantsColorBreakdown) {
      const materialGroups = new Map<
        string,
        {
          count: number;
          weight: number;
          colors: Map<string, { count: number; weight: number }>;
        }
      >();

      for (const filament of activeFilaments) {
        const material = filament.material?.name || 'Matière inconnue';
        const color = this.normalizeDisplayColor(
          filament.colorName || filament.color || filament.colorHex,
        );
        const weight = Number(filament.weightRemaining || 0);
        const materialGroup = materialGroups.get(material) || {
          count: 0,
          weight: 0,
          colors: new Map<string, { count: number; weight: number }>(),
        };
        materialGroup.count += 1;
        materialGroup.weight += weight;
        const colorGroup = materialGroup.colors.get(color) || {
          count: 0,
          weight: 0,
        };
        colorGroup.count += 1;
        colorGroup.weight += weight;
        materialGroup.colors.set(color, colorGroup);
        materialGroups.set(material, materialGroup);
      }

      const sortedMaterials = [...materialGroups.entries()].sort(
        (a, b) => b[1].weight - a[1].weight,
      );
      const lines: string[] = [
        `Vous avez **${activeCount} bobine(s) actives** en stock, pour un total de **${Math.round(totalWeight)}g**.`,
        '',
        '**Répartition par matière et couleur :**',
      ];

      for (const [material, group] of sortedMaterials) {
        lines.push(
          `- **${material}** : ${group.count} bobine(s), **${Math.round(group.weight)}g**`,
        );
        const sortedColors = [...group.colors.entries()].sort(
          (a, b) => b[1].weight - a[1].weight,
        );
        for (const [color, colorGroup] of sortedColors) {
          lines.push(
            `  - ${color} : ${colorGroup.count} bobine(s), ${Math.round(colorGroup.weight)}g`,
          );
        }
        lines.push('');
      }

      return {
        intent: 'stock_overview',
        answer: lines.join('\n').trimEnd(),
        data: {
          activeCount,
          totalWeight,
          breakdown: sortedMaterials.map(([material, group]) => ({
            material,
            count: group.count,
            weight: group.weight,
            colors: [...group.colors.entries()].map(([color, colorGroup]) => ({
              color,
              count: colorGroup.count,
              weight: colorGroup.weight,
            })),
          })),
        },
      };
    }

    return {
      intent: 'stock_overview',
      answer: `Vous avez **${activeCount} bobines actives** en stock, pour un total de **${Math.round(totalWeight)}g** de filament.`,
      data: { activeCount, totalWeight },
    };
  }

  private normalizeDisplayColor(color?: string | null): string {
    if (!color) return 'Couleur non renseignée';
    const cleaned = color.trim();
    if (['-', '_', '—', '–'].includes(cleaned)) {
      return 'Couleur non renseignée';
    }
    return cleaned;
  }

  private async handleLowStock(user: any): Promise<AgentResponse> {
    const filaments = await this.filamentService.findAll(user.organizationId);
    const lowStock = filaments
      .filter((f) => {
        if (f.weightRemaining <= 0) return false;
        return f.weightRemaining < f.weightInitial * 0.2; // Less than 20%
      })
      .sort((a, b) => a.weightRemaining - b.weightRemaining);

    if (lowStock.length === 0) {
      return {
        intent: 'low_stock',
        answer: `Tout va bien ! Aucune de vos bobines actives n'est en dessous de 20% de sa capacité.`,
      };
    }

    let answer = `Attention, **${lowStock.length} bobine(s)** sont presque vides (< 20%) :\n\n`;
    lowStock.slice(0, 5).forEach((f) => {
      answer += `- ${f.brand?.name || 'Inconnu'} ${f.colorName || f.color} : **${Math.round(f.weightRemaining)}g restants**\n`;
    });
    if (lowStock.length > 5)
      answer += `\n*... et ${lowStock.length - 5} autres.*`;

    return { intent: 'low_stock', answer, data: lowStock };
  }

  private async handleDepletionForecast(user: any): Promise<AgentResponse> {
    const history = await this.filamentService.getAllConsumptionHistory(
      user.organizationId,
      user.isSuperAdmin,
    );

    if (
      history.restricted ||
      !history.forecasts ||
      history.forecasts.length === 0
    ) {
      return {
        intent: 'depletion_forecast',
        answer:
          "Je n'ai pas assez de données de consommation pour faire des prédictions fiables. Continuez à enregistrer vos impressions !",
      };
    }

    const critical = history.forecasts.filter(
      (f: any) => f.status === 'critical' || f.status === 'warning',
    );

    if (critical.length === 0) {
      return {
        intent: 'depletion_forecast',
        answer:
          "Bonne nouvelle ! D'après vos habitudes d'impression, aucune rupture de stock n'est prévue dans les 30 prochains jours.",
      };
    }

    let answer = `🚨 Prédictions d'épuisement basées sur vos habitudes :\n\n`;
    critical.slice(0, 5).forEach((f: any) => {
      const dateStr = f.estimatedDepletionDate
        ? new Date(f.estimatedDepletionDate).toLocaleDateString()
        : 'Bientôt';
      answer += `- ${f.name} : **~${f.daysRemaining} jours restants** (Rupture estimée: ${dateStr})\n`;
    });

    return { intent: 'depletion_forecast', answer, data: critical };
  }

  private async handleTotalConsumption(user: any): Promise<AgentResponse> {
    const history = await this.filamentService.getAllConsumptionHistory(
      user.organizationId,
      user.isSuperAdmin,
    );
    const totalAmount = history.logs.reduce(
      (sum: number, log: any) => sum + log.amount,
      0,
    );
    const printCount = history.logs.filter(
      (log: any) => log.type === 'PRINT',
    ).length;

    return {
      intent: 'total_consumption',
      answer: `Depuis vos débuts, vous avez consommé un total de **${Math.round(totalAmount)}g** de filament, avec **${printCount} impressions** (hors échecs et calibrations).`,
      data: { totalAmount, printCount },
    };
  }

  private async handleConsumptionMonth(user: any): Promise<AgentResponse> {
    const history = await this.filamentService.getAllConsumptionHistory(
      user.organizationId,
      user.isSuperAdmin,
    );

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthLogs = history.logs.filter(
      (l: any) => new Date(l.date) >= startOfMonth,
    );
    const totalMonth = monthLogs.reduce(
      (sum: number, log: any) => sum + log.amount,
      0,
    );

    return {
      intent: 'consumption_month',
      answer: `Ce mois-ci, vous avez consommé **${Math.round(totalMonth)}g** de filament sur un total de ${monthLogs.length} actions enregistrées.`,
      data: { totalMonth, count: monthLogs.length },
    };
  }

  private async handleMostUsed(user: any): Promise<AgentResponse> {
    const history = await this.filamentService.getAllConsumptionHistory(
      user.organizationId,
      user.isSuperAdmin,
    );

    const usageMap: Record<number, { name: string; amount: number }> = {};

    history.logs.forEach((log: any) => {
      if (!log.filament) return;
      const fid = log.filament.id;
      if (!usageMap[fid]) {
        const name = log.filament.brand
          ? `${log.filament.brand.name} ${log.filament.colorName || log.filament.color}`
          : `Filament #${fid}`;
        usageMap[fid] = { name, amount: 0 };
      }
      usageMap[fid].amount += log.amount;
    });

    const sorted = Object.values(usageMap).sort((a, b) => b.amount - a.amount);

    if (sorted.length === 0) {
      return {
        intent: 'most_used',
        answer:
          "Vous n'avez pas encore de données de consommation suffisantes pour déterminer vos favoris.",
      };
    }

    let answer = `🏆 Vos filaments les plus utilisés: \n\n`;
    sorted.slice(0, 3).forEach((item, index) => {
      answer += `${index + 1}. ** ${item.name}** (${Math.round(item.amount)}g) \n`;
    });

    return { intent: 'most_used', answer, data: sorted.slice(0, 3) };
  }

  private async handleProjectStatus(user: any): Promise<AgentResponse> {
    const projects = await this.projectsService.findAll(user);

    const active = projects.filter(
      (p) => p.status === 'PLANNING' || p.status === 'IN_PROGRESS',
    );

    if (active.length === 0) {
      return {
        intent: 'project_status',
        answer: "Vous n'avez actuellement aucun projet en cours ou planifié.",
      };
    }

    let answer = `Vous avez ** ${active.length} projet(s) actif(s) ** : \n\n`;
    active.forEach((p) => {
      const statusLabel =
        p.status === 'IN_PROGRESS' ? 'En cours 🚀' : 'Planifié 📋';
      answer += `- ** ${p.name}** : ${statusLabel} \n`;
    });

    return { intent: 'project_status', answer, data: active };
  }

  private async handleFinancialStats(user: any): Promise<AgentResponse> {
    const history = await this.filamentService.getAllConsumptionHistory(
      user.organizationId,
      user.isSuperAdmin,
    );

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let totalCost = 0;
    let monthCost = 0;

    history.logs.forEach((log: any) => {
      const filament = log.filament;
      if (!filament || !filament.price || filament.weightInitial <= 0) return;

      const costPerGram = filament.price / filament.weightInitial;
      const logCost = costPerGram * log.amount;

      totalCost += logCost;

      if (new Date(log.date) >= startOfMonth) {
        monthCost += logCost;
      }
    });

    return {
      intent: 'financial_stats',
      answer: `💶 **Statistiques Financières** :\n\n- Ce mois-ci : **${monthCost.toFixed(2)} €**\n- Au total depuis le début : **${totalCost.toFixed(2)} €**\n\n*(Estimé à partir du prix d'achat et du poids consommé)*`,
      data: { totalCost, monthCost },
    };
  }

  private async handleFeasibleProjects(user: any): Promise<AgentResponse> {
    const projects = await this.projectsService.findAll(user);
    const active = projects.filter(
      (p) => p.status === 'PLANNING' || p.status === 'IN_PROGRESS',
    );

    if (active.length === 0) {
      return {
        intent: 'feasible_projects',
        answer: "Vous n'avez aucun projet planifié ou en cours pour le moment.",
      };
    }

    let answer = `🛠️ **Analyse de faisabilité de vos projets** :\n\n`;
    let feasibleCount = 0;

    for (const p of active) {
      const report = await this.projectsService.checkFeasibility(p.id, user);
      if (report.overallStatus === 'OK') {
        feasibleCount++;
        answer += `- **${p.name}** : ✅ Faisable avec le stock actuel\n`;
      } else if (report.overallStatus === 'RISK') {
        answer += `- **${p.name}** : ⚠️ Risque de manque de bobines\n`;
      } else {
        answer += `- **${p.name}** : ❌ Stock insuffisant pour certains éléments\n`;
      }
    }

    if (feasibleCount === 0) {
      answer =
        `Malheureusement, aucun de vos ${active.length} projets actifs n'est entièrement faisable. Pensez à recommander du filament !\n\n` +
        answer;
    } else {
      answer =
        `Bonne nouvelle ! **${feasibleCount}** projet(s) sur **${active.length}** sont réalisables immédiatement.\n\n` +
        answer;
    }

    return { intent: 'feasible_projects', answer, data: active };
  }

  private async handleFeedback(
    user: any,
    question: string,
    ip: string,
  ): Promise<AgentResponse> {
    try {
      await this.emailService.sendFeedbackEmail(user, ip, question);
      return {
        intent: 'feedback',
        answer: `📨 Merci beaucoup pour votre feedback ! Votre message a bien été transmis. \n\n*Note : Pour signaler un bug précis ou joindre une capture d'écran, utilisez plutôt l'icône de bouée (🛟) en haut de l'écran.*`,
      };
    } catch (error) {
      return {
        intent: 'feedback',
        answer: `❌ Oups, une erreur s'est produite lors de l'envoi de votre feedback. Vous pouvez aussi utiliser l'icône de bouée (🛟) en haut de l'écran pour nous contacter.`,
        isError: true,
      };
    }
  }

  private async handleCreateFilament(
    user: any,
    question: string,
  ): Promise<AgentResponse> {
    // Simple NLP parser for creation: "ajoute une bobine de PLA Bambulab de 1kg rouge"
    const q = question.toLowerCase();
    let brandName = '';
    let materialName = '';
    let color = 'Inconnu';
    let weight = 1000; // Default 1kg

    // 1. Try to extract weight (e.g. 500g, 1kg)
    const weightMatch = q.match(/(\d+(?:\.\d+)?)\s*(kg|g)/);
    if (weightMatch) {
      const val = parseFloat(weightMatch[1]);
      const unit = weightMatch[2];
      weight = unit === 'kg' ? val * 1000 : val;
    }

    // 2. Try to find a known material
    const materials = await this.materialRepository.find();
    for (const mat of materials) {
      if (q.includes(mat.name.toLowerCase())) {
        materialName = mat.name;
        break;
      }
    }
    if (!materialName && q.includes('pla')) materialName = 'PLA';
    if (!materialName && q.includes('petg')) materialName = 'PETG';
    if (!materialName && q.includes('abs')) materialName = 'ABS';
    if (!materialName && q.includes('tpu')) materialName = 'TPU';

    // 3. Try to extract a brand (rough lookup)
    const brands = await this.brandRepository.find();
    for (const b of brands) {
      if (q.includes(b.name.toLowerCase())) {
        brandName = b.name;
        break;
      }
    }

    // Custom check for ArianePlast if it's written differently
    if (!brandName && q.includes('ariane') && q.includes('plast')) {
      brandName = 'ArianePlast';
    }

    // Extract some common colors and map to Hex
    const colorMap: Record<string, string> = {
      rouge: '#FF0000',
      bleu: '#0000FF',
      vert: '#00FF00',
      noir: '#000000',
      blanc: '#FFFFFF',
      jaune: '#FFFF00',
      orange: '#FFA500',
      violet: '#800080',
      rose: '#FFC0CB',
      gris: '#808080',
      marron: '#8B4513',
      transparent: '#FFFFFF', // Fallback for transparent
      or: '#FFD700',
      argent: '#C0C0C0',
      cuivre: '#B87333',
      bronze: '#CD7F32',
      bois: '#DEB887',
    };

    for (const [cName, hex] of Object.entries(colorMap)) {
      if (q.includes(cName)) {
        color = hex;
        break;
      }
    }

    // 4. Try to extract a type directly from the user's custom types
    let typeEntity: FilamentType | null = null;
    const types = await this.typeRepository.find();

    for (const t of types) {
      const tLower = t.name.toLowerCase();
      // Prevent matching extremely short/common sub-strings unless bounded
      if (tLower.length >= 2 && q.match(new RegExp(`\\b${tLower}\\b`))) {
        typeEntity = t;
        break;
      } else if (tLower.length > 3 && q.includes(tLower)) {
        typeEntity = t;
        break;
      }
    }

    if (!brandName && !materialName) {
      return {
        intent: 'create_filament',
        answer: `❌ Je n'ai pas pu comprendre la marque ni la matière pour créer la bobine.\n\nEssayez une phrase comme : *"Ajoute une bobine de PLA BambuLab noire de 1kg"*`,
        isError: true,
      };
    }

    if (!brandName) brandName = 'Générique';
    if (!materialName) materialName = 'PLA';

    // Find actual DB entities
    const brand = await this.brandRepository.findOne({
      where: { name: ILike(`%${brandName}%`) },
    });
    const material = await this.materialRepository.findOne({
      where: { name: ILike(`%${materialName}%`) },
    });

    if (!brand) {
      return {
        intent: 'create_filament',
        answer: `❌ Je ne connais pas la marque **${brandName}** dans votre base de données. Créez-la d'abord dans les paramètres.`,
        isError: true,
      };
    }
    if (!material) {
      return {
        intent: 'create_filament',
        answer: `❌ Je ne connais pas la matière **${materialName}** dans votre base de données. Créez-la d'abord dans les paramètres.`,
        isError: true,
      };
    }

    // Types are already resolved above into typeEntity

    // Attempt to create
    try {
      const filamentData: any = {
        brand,
        material,
        color,
        colors: [color],
        weightInitial: weight,
        weightRemaining: weight,
        organization: { id: user.organizationId },
      };
      if (typeEntity) filamentData.types = [typeEntity];

      const newFilament = this.filamentRepository.create(filamentData);

      await this.filamentRepository.save(newFilament);

      const typeStr = typeEntity ? ` ${typeEntity.name}` : '';

      return {
        intent: 'create_filament',
        answer: `✅ **Bobine créée avec succès !**\n\nJ'ai ajouté une bobine de **${brand.name} ${material.name}${typeStr} ${color}** (${weight}g) à votre inventaire.`,
        data: newFilament,
      };
    } catch (e: any) {
      console.error('Error creating filament via AI:', e);
      if (e.message && e.message.includes('Plan limit')) {
        return {
          intent: 'create_filament',
          answer: `❌ Limite d'abonnement atteinte. Vous ne pouvez plus ajouter de bobines.`,
          isError: true,
        };
      }
      return {
        intent: 'create_filament',
        answer: `❌ Une erreur technique est survenue lors de la création.`,
        isError: true,
      };
    }
  }

  private async handleCreateConsumption(
    user: any,
    question: string,
  ): Promise<AgentResponse> {
    // NLP for: "j'ai imprimé un truc avec la bobine de PLA Bambulab rouge, il y en a pour 50g"
    const q = question.toLowerCase();

    // 1. Extract weight
    let weight = 0;
    const weightMatch = q.match(/(\d+(?:\.\d+)?)\s*(g|gr|grammes)/);
    if (weightMatch) {
      weight = parseFloat(weightMatch[1]);
    }

    if (weight <= 0) {
      return {
        intent: 'create_consumption',
        answer: `❌ Je n'ai pas compris la quantité. Veuillez préciser le poids en grammes (ex: 50g).`,
        isError: true,
      };
    }

    // 2. Try to find which filament it is
    // We will fetch all user's active filaments and try to match keywords
    const activeFilaments = await this.filamentService.findAll(
      user.organizationId,
    );

    if (activeFilaments.length === 0) {
      return {
        intent: 'create_consumption',
        answer: `❌ Vous n'avez aucune bobine dans votre inventaire.`,
        isError: true,
      };
    }

    let bestMatch: Filament | null = null;
    let maxScore = 0;

    for (const f of activeFilaments) {
      let score = 0;
      if (f.brand && q.includes(f.brand.name.toLowerCase())) score += 2;
      if (f.material && q.includes(f.material.name.toLowerCase())) score += 2;
      if (f.color && q.includes(f.color.toLowerCase())) score += 1;

      if (score > maxScore) {
        maxScore = score;
        bestMatch = f;
      }
    }

    // If score is too low, we might pick the wrong spool
    if (!bestMatch || maxScore < 2) {
      return {
        intent: 'create_consumption',
        answer: `❌ Je n'ai pas pu identifier précisément la bobine utilisée. Soyez plus précis sur la **marque** et la **matière** (ex: PLA BambuLab).`,
        isError: true,
      };
    }

    if (bestMatch.weightRemaining < weight) {
      return {
        intent: 'create_consumption',
        answer: `❌ La bobine **${bestMatch.brand?.name} ${bestMatch.material?.name}** n'a pas assez de filament restant (${bestMatch.weightRemaining}g) pour cette impression (${weight}g).`,
        isError: true,
      };
    }

    try {
      await this.filamentService.logConsumption(
        bestMatch.id,
        weight,
        'PRINT',
        'Ajouté via Assistant IA',
        user.organizationId,
      );

      return {
        intent: 'create_consumption',
        answer: `✅ **Consommation ajoutée !**\n\nJ'ai déduit **${weight}g** de la bobine **${bestMatch.brand?.name} ${bestMatch.material?.name} ${bestMatch.color || ''}**. Il reste maintenant **${bestMatch.weightRemaining - weight}g**.`,
        data: { filamentId: bestMatch.id, amount: weight },
      };
    } catch (e) {
      return {
        intent: 'create_consumption',
        answer: `❌ Une erreur est survenue lors de l'enregistrement de la consommation.`,
        isError: true,
      };
    }
  }
}
