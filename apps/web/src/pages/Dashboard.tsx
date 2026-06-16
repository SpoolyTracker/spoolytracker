import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Grid,
    IconButton,
    LinearProgress,
    Tooltip,
    Typography
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
    AlertTriangle,
    Calendar,
    CalendarClock,
    Euro,
    Eye,
    EyeOff,
    Info,
    TrendingUp,
    Weight,
    X
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConsumptionLog, Filament } from '../api';
import { api, BASE_URL } from '../api';
import AnalyticsCard from '../components/AnalyticsCard';
import { AiInsightBanner } from '../components/AiInsightBanner';
import ColorIndicator from '../components/ColorIndicator';
import ConsumptionTrendCard from '../components/dashboard/ConsumptionTrendCard';
import TopConsumptionCard from '../components/dashboard/TopConsumptionCard';
import StockOverviewCard from '../components/dashboard/StockOverviewCard';
import RecentActivityCard from '../components/dashboard/RecentActivityCard';
import type { DashboardActivity } from '../components/dashboard/types';
import { useAuth } from '../contexts/AuthContext';
import { checkIsLowStock, getFilamentTitle } from '../utils/filament-utils';
import { WidgetEditBar, WidgetGrid, useWidgetLayout, type WidgetDef } from '../widgets';

const DASH_DEFS: WidgetDef[] = [
    { id: 'dash-trend', defaultSize: 8 },
    { id: 'dash-top', defaultSize: 4 },
    { id: 'dash-stock', defaultSize: 8 },
    { id: 'dash-activity', defaultSize: 4 },
];

const DASH_TITLES: Record<string, string> = {
    'dash-trend': 'Tendance de consommation',
    'dash-top': 'Top consommation',
    'dash-stock': 'Aperçu du stock',
    'dash-activity': 'Activité récente',
};

export default function DashboardPage() {
    const { t } = useTranslation();
    const { user, isLoading: authLoading } = useAuth();
    const theme = useTheme();
    const [filaments, setFilaments] = useState<Filament[]>([]);
    const [history, setHistory] = useState<ConsumptionLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [restricted, setRestricted] = useState(false);
    const [showRiskAnalysis, setShowRiskAnalysis] = useState(() => localStorage.getItem('hideRiskAnalysis') !== 'true');
    const [organization, setOrganization] = useState<{ id?: number | string; plan?: string; trialEndsAt?: string | null } | null>(null);

    const layout = useWidgetLayout('dashboard', DASH_DEFS);

    useEffect(() => {
        if (!authLoading && user) {
            loadData();
        }
        const handleUpdate = () => loadData();
        window.addEventListener('inventory-updated', handleUpdate);
        return () => window.removeEventListener('inventory-updated', handleUpdate);
    }, [authLoading, user]);

    const loadData = async () => {
        try {
            const orgId = localStorage.getItem('organization_id') || '1';
            const [filamentsData, historyData, orgData] = await Promise.all([
                api.getAll(),
                api.getAllConsumptionHistory(),
                api.getOrgData(orgId)
            ]);
            setFilaments(filamentsData || []);
            if (Array.isArray(historyData)) {
                setHistory(historyData);
                setRestricted(false);
            } else if (historyData && Array.isArray((historyData as { logs?: ConsumptionLog[] }).logs)) {
                const payload = historyData as { logs: ConsumptionLog[]; restricted?: boolean };
                setHistory(payload.logs);
                setRestricted(payload.restricted === true);
            } else {
                setHistory([]);
                setRestricted(false);
            }
            setOrganization(orgData);
            if (orgData?.plan) {
                const isEligible = orgData.plan === 'pro' || orgData.plan === 'enterprise' || orgData.plan === 'beta' || Boolean(orgData.trialEndsAt && new Date(orgData.trialEndsAt) > new Date());
                localStorage.setItem('organization_plan', isEligible ? 'pro' : 'free');
            }
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const {
        groupedFilaments,
        totalVirtualWeight,
        totalPhysicalWeight,
        totalPlannedWeight,
        totalPhysicalValue,
        totalPlannedValue
    } = useMemo(() => {
        const groups: Record<string, {
            id: string; displayName: string; brand: string; type: string;
            weightRemaining: number; weightInitial: number; plannedWeight: number;
            virtualWeightRemaining: number; color: string; colors: string[];
        }> = {};

        const totalPlanned = history.filter(l => l.is_planned).reduce((sum, l) => sum + l.amount, 0);
        let totalPhysical = 0;
        let totalPhysVal = 0;
        let totalPlanVal = 0;

        const plannedByFilament: Record<number, { amount: number, value: number }> = {};
        history.forEach(l => {
            if (l.is_planned && l.filamentId) {
                if (!plannedByFilament[l.filamentId]) plannedByFilament[l.filamentId] = { amount: 0, value: 0 };
                plannedByFilament[l.filamentId].amount += l.amount;
                const price = l.filament?.price || 0;
                const initial = l.filament?.weightInitial || 1000;
                const pricePerGram = initial > 0 ? (price / initial) : 0;
                plannedByFilament[l.filamentId].value += l.amount * pricePerGram;
            }
        });

        filaments.forEach(f => {
            const title = getFilamentTitle(f);
            const colors = f.colors || [];
            const key = `${title}-${f.color}-${colors.join(',')}`;
            if (!groups[key]) {
                groups[key] = {
                    id: key, displayName: title, brand: f.brand?.name || 'Unknown', type: f.type?.name || 'Unknown',
                    weightRemaining: 0, weightInitial: 0, plannedWeight: 0, virtualWeightRemaining: 0,
                    color: f.color, colors: colors
                };
            }
            groups[key].weightRemaining += f.weightRemaining;
            groups[key].weightInitial += f.weightInitial;
            const plannedData = plannedByFilament[f.id] || { amount: 0, value: 0 };
            const groupPlanned = plannedData.amount;
            groups[key].plannedWeight += groupPlanned;
            groups[key].virtualWeightRemaining += (f.weightRemaining - groupPlanned);
            totalPhysical += f.weightRemaining;
            const price = f.price || 0;
            const initial = f.weightInitial || 1000;
            const pricePerGram = initial > 0 ? (price / initial) : 0;
            totalPhysVal += f.weightRemaining * pricePerGram;
            totalPlanVal += plannedData.value;
        });

        const totalVirtual = totalPhysical - totalPlanned;
        return {
            groupedFilaments: Object.values(groups),
            totalVirtualWeight: totalVirtual,
            totalPhysicalWeight: totalPhysical,
            totalPlannedWeight: totalPlanned,
            totalPhysicalValue: totalPhysVal,
            totalPlannedValue: totalPlanVal
        };
    }, [filaments, history]);

    const topConsumptionGroups = useMemo(() => {
        const stockMap: Record<string, number> = {};
        filaments.forEach(f => {
            const title = getFilamentTitle(f);
            const colors = f.colors || [];
            const key = `${title}-${f.color}-${colors.join(',')}`;
            if (!stockMap[key]) stockMap[key] = 0;
            stockMap[key] += f.weightRemaining;
        });

        const consumptionMap: Record<string, {
            id: string; displayName: string; brand: string; type: string; color: string; colors: string[];
            amount: number; plannedAmount: number; cost: number; plannedCost: number; stock: number;
        }> = {};

        history.forEach(log => {
            const title = getFilamentTitle(log.filament);
            const colors = log.filament?.colors || [];
            const color = log.filament?.color || '';
            const key = `${title}-${color}-${colors.join(',')}`;
            if (!consumptionMap[key]) {
                consumptionMap[key] = {
                    id: key, displayName: title, brand: log.filament?.brand?.name || 'Unknown', type: log.filament?.type?.name || 'Unknown',
                    color: color, colors: colors, amount: 0, plannedAmount: 0, cost: 0, plannedCost: 0, stock: stockMap[key] || 0
                };
            }
            const price = log.filament?.price || 0;
            const weightInitial = log.filament?.weightInitial || 1000;
            const pricePerGram = weightInitial > 0 ? (price / weightInitial) : 0;
            if (log.is_planned) {
                consumptionMap[key].plannedAmount += log.amount;
                consumptionMap[key].plannedCost += log.amount * pricePerGram;
            } else {
                consumptionMap[key].amount += log.amount;
                consumptionMap[key].cost += log.amount * pricePerGram;
            }
        });

        return Object.values(consumptionMap)
            .sort((a, b) => (b.amount + b.plannedAmount) - (a.amount + a.plannedAmount))
            .slice(0, 5);
    }, [history, filaments]);

    const lowStockFilaments = filaments.filter(f => f.weightRemaining > 0 && checkIsLowStock(f, organization));

    const topConsumedGroup = topConsumptionGroups.length > 0 ? topConsumptionGroups[0] : null;
    const topConsumedValue = topConsumedGroup ? `${Math.round(topConsumedGroup.amount)}g` : '0g';

    const daysRemaining = useMemo(() => {
        if (totalVirtualWeight <= 0) return 0;
        const now = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        let totalConsumed30d = 0;
        history.forEach(log => {
            if (!log.is_planned && new Date(log.date) >= thirtyDaysAgo) {
                totalConsumed30d += log.amount;
            }
        });
        const avgDaily = totalConsumed30d / 30;
        if (avgDaily <= 0) return 999;
        return Math.round(totalVirtualWeight / avgDaily);
    }, [totalVirtualWeight, history]);

    const formatRemainingTime = (days: number): string => {
        if (days < 365) return `${days} jours`;
        const years = Math.floor(days / 365);
        const months = Math.floor((days % 365) / 30);
        return `${years} an${years > 1 ? 's' : ''}${months > 0 ? ` ${months} mois` : ''}`;
    };

    const riskyGroups = useMemo(() => {
        if (history.length === 0) return [];
        const computeDaysLeft = (g: typeof topConsumptionGroups[number]) => {
            const now = new Date();
            const cutoff = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
            const groupLogs = history.filter(h => {
                const title = getFilamentTitle(h.filament);
                const color = h.filament?.color || '';
                const key = `${title}-${color}-${(h.filament?.colors || []).join(',')}`;
                return key === g.id && new Date(h.date) >= cutoff;
            });
            const used30d = groupLogs.reduce((sum, l) => sum + l.amount, 0);
            if (used30d === 0) return null;
            const dailyRate = used30d / 30;
            return g.stock / dailyRate;
        };
        return topConsumptionGroups
            .map(g => {
                const daysLeft = computeDaysLeft(g);
                return daysLeft !== null && daysLeft < 30 ? { ...g, daysLeft: Math.round(daysLeft) } : null;
            })
            .filter((g): g is typeof topConsumptionGroups[number] & { daysLeft: number } => g !== null);
    }, [topConsumptionGroups, history]);

    const recentActivities = useMemo<DashboardActivity[]>(() => {
        const activities: DashboardActivity[] = [];
        history.forEach(log => {
            activities.push({
                id: `log-${log.id}`, type: 'consumption', date: new Date(log.date),
                amount: log.amount, filament: log.filament, isPlanned: log.is_planned, notes: log.notes
            });
        });
        filaments.forEach(f => {
            if (f.createdAt) {
                activities.push({ id: `create-${f.id}`, type: 'creation', date: new Date(f.createdAt), filament: f });
            }
        });
        return activities.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);
    }, [history, filaments]);

    const registry = useMemo<Record<string, ReactNode>>(() => ({
        'dash-trend': <ConsumptionTrendCard history={history} restricted={restricted} />,
        'dash-top': <TopConsumptionCard groups={topConsumptionGroups} />,
        'dash-stock': <StockOverviewCard groups={groupedFilaments} />,
        'dash-activity': <RecentActivityCard activities={recentActivities} />,
    }), [history, restricted, topConsumptionGroups, groupedFilaments, recentActivities]);

    const isProEligible = (organization?.plan === 'pro' || organization?.plan === 'enterprise' || organization?.plan === 'beta') || (organization?.trialEndsAt && new Date(organization.trialEndsAt) > new Date());

    if (loading) return <LinearProgress />;

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="h2">{t('sidebar.dashboard', 'Tableau de bord')}</Typography>
                <WidgetEditBar {...layout} titleFor={(id) => DASH_TITLES[id]} />
            </Box>

            <Grid container spacing={3}>
                <Grid size={{ xs: 12 }}>
                    <AiInsightBanner plan={organization?.plan as 'free' | 'pro' | 'enterprise' | 'beta' | undefined} trialEndsAt={organization?.trialEndsAt} />
                </Grid>

                {(lowStockFilaments.length > 0 || riskyGroups.length > 0) && showRiskAnalysis && (
                    <Grid size={{ xs: 12 }}>
                        <Card sx={{ bgcolor: 'rgba(239, 68, 68, 0.05)', border: '1px solid', borderColor: 'error.main', position: 'relative', overflow: 'hidden' }}>
                            {!isProEligible && (
                                <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(4px)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                                    <Typography variant="h6" fontWeight="bold">{t('dashboard.proFeature', '👑 Fonctionnalité Pro')}</Typography>
                                    <Typography variant="body2" color="text.secondary">{t('dashboard.upgradeToProRisk', 'Passez au plan Pro pour l\'analyse de risque IA.')}</Typography>
                                    {!organization?.trialEndsAt && (
                                        <Button variant="contained" color="primary" onClick={async () => {
                                            try {
                                                const res = await fetch(`${BASE_URL}/stripe/create-checkout-session`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'x-organization-id': String(organization?.id) },
                                                    body: JSON.stringify({ plan: 'pro', organizationId: organization?.id })
                                                });
                                                if (res.ok) { const { url } = await res.json(); window.location.href = url; }
                                                else { const data = await res.json().catch(() => ({})); alert(t('dashboard.trialError', data.message || 'Erreur lors du démarrage de l\'essai.')); }
                                            } catch (e) { console.error(e); alert(t('dashboard.trialError', 'Erreur lors du démarrage de l\'essai.')); }
                                        }}>
                                            {t('dashboard.startTrial', { trialDays: import.meta.env.VITE_DEFAULT_TRIAL_DAYS || 14, defaultValue: `Démarrer l'essai gratuit (${import.meta.env.VITE_DEFAULT_TRIAL_DAYS || 14}j)` })}
                                        </Button>
                                    )}
                                </Box>
                            )}
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <AlertTriangle color={theme.palette.error.main} />
                                        <Typography variant="h6" fontWeight="bold" color="error.main">{t('dashboard.smartRiskAnalysis', 'Analyse de Risque IA')}</Typography>
                                    </Box>
                                    <IconButton size="small" onClick={() => { setShowRiskAnalysis(false); localStorage.setItem('hideRiskAnalysis', 'true'); }} aria-label="close"><X size={18} /></IconButton>
                                </Box>
                                {lowStockFilaments.length > 0 && (
                                    <Box mb={2}>
                                        <Typography variant="subtitle2" gutterBottom fontWeight="bold">{t('dashboard.lowStockBase', 'Stock faible (Basé sur le seuil)')}</Typography>
                                        <Typography variant="body2" color="textSecondary">{lowStockFilaments.map(f => `${getFilamentTitle(f)} (${f.weightRemaining.toFixed(2)}g)`).join(', ')}</Typography>
                                    </Box>
                                )}
                                <Box>
                                    <Typography variant="subtitle2" gutterBottom fontWeight="bold">{t('dashboard.highDepletionRisk', 'Risque élevé d\'épuisement (Prochains 30 Jours)')}</Typography>
                                    {riskyGroups.length === 0 ? (
                                        <Typography variant="body2" color="success.main">{t('dashboard.noHighRisk', 'Aucun filament à risque élevé détecté selon votre consommation récente.')}</Typography>
                                    ) : (
                                        <Box display="flex" flexWrap="wrap" gap={1}>
                                            {riskyGroups.map((g) => (
                                                <Chip key={g.id} label={`${g.displayName} (${t('dashboard.daysLeft', { count: g.daysLeft, defaultValue: `${g.daysLeft} jours restants` })})`} color="warning" size="small" icon={<TrendingUp size={14} />} />
                                            ))}
                                        </Box>
                                    )}
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                )}

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <AnalyticsCard
                        title={t('dashboard.totalValue') || 'Valeur du Stock'}
                        value={`${totalPhysicalValue.toFixed(2)}€`}
                        icon={Euro}
                        gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
                        subtitle={
                            <Box component="span" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{t('dashboard.availableShort', 'Dispo')} :</span>
                                    <span style={{ fontWeight: 700 }}>{(totalPhysicalValue - totalPlannedValue).toFixed(2)}€</span>
                                </Box>
                                <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between', opacity: 0.8 }}>
                                    <span>{t('dashboard.plannedShort', 'Planifié')} :</span>
                                    <span style={{ fontWeight: 700 }}>{totalPlannedValue.toFixed(2)}€</span>
                                </Box>
                            </Box>
                        }
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <AnalyticsCard
                        title={t('dashboard.favoriteFilament')}
                        value={topConsumedValue}
                        icon={TrendingUp}
                        gradient="linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)"
                        subtitle={
                            topConsumedGroup ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <ColorIndicator colors={topConsumedGroup.colors || []} primaryColor={topConsumedGroup.color} size={16} />
                                    <Typography variant="caption" sx={{ color: 'white', opacity: 0.9 }}>{topConsumedGroup.displayName}</Typography>
                                </Box>
                            ) : t('common.none')
                        }
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <AnalyticsCard
                        title={t('dashboard.estRunway')}
                        value={restricted ? 'PRO' : formatRemainingTime(daysRemaining)}
                        icon={Calendar}
                        gradient={restricted ? 'linear-gradient(135deg, #2c3e50 0%, #4ca1af 100%)' : (daysRemaining < 14 ? 'linear-gradient(135deg, #cb2d3e 0%, #ef473a 100%)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)')}
                        subtitle={
                            restricted ? 'Disponible avec le plan Pro' : (
                                <Tooltip title={t('dashboard.runwayExplanation', 'Calculé sur le stock disponible (Réel - Planifié) et la consommation réelle des 30 derniers jours.')}>
                                    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'help' }}>
                                        {t('dashboard.basedOnAvailable', 'Basé sur dispo')} <Info size={12} />
                                    </Box>
                                </Tooltip>
                            )
                        }
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <AnalyticsCard
                        title={t('dashboard.availableWeight')}
                        value={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {`${(totalVirtualWeight / 1000).toFixed(1)} kg`}
                                {totalPlannedWeight > 0 && (
                                    <Tooltip title={`${(totalPlannedWeight / 1000).toFixed(2)}kg planifiés`}>
                                        <CalendarClock size={24} style={{ opacity: 0.8 }} />
                                    </Tooltip>
                                )}
                            </Box>
                        }
                        icon={Weight}
                        gradient="linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)"
                        subtitle={`${(totalPhysicalWeight / 1000).toFixed(2)} kg réels (dont ${totalPlannedWeight < 1000 ? `${totalPlannedWeight.toFixed(0)}g` : `${(totalPlannedWeight / 1000).toFixed(2)}kg`} planifiés)`}
                        actionNode={
                            (lowStockFilaments.length > 0 || riskyGroups.length > 0) ? (
                                <IconButton size="small" onClick={() => {
                                    const next = !showRiskAnalysis;
                                    setShowRiskAnalysis(next);
                                    localStorage.setItem('hideRiskAnalysis', next ? 'false' : 'true');
                                }} sx={{ color: 'white', opacity: 0.8, '&:hover': { opacity: 1 } }}>
                                    {showRiskAnalysis ? <EyeOff size={20} /> : <Eye size={20} />}
                                </IconButton>
                            ) : undefined
                        }
                    />
                </Grid>
            </Grid>

            <Box sx={{ mt: 3 }}>
                <WidgetGrid
                    items={layout.items}
                    isEditing={layout.isEditing}
                    bare
                    onReorder={layout.reorder}
                    onToggleHide={layout.toggleHidden}
                    onSizeChange={layout.setSize}
                    titleFor={(id) => DASH_TITLES[id]}
                    renderWidget={(id) => registry[id] ?? null}
                />
            </Box>
        </Box>
    );
}
