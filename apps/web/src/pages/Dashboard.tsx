import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Divider,
    Grid,
    IconButton,
    LinearProgress,
    ToggleButton,
    ToggleButtonGroup,
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
    History,
    Info,
    PencilRuler,
    Sparkles,
    TrendingUp,
    Weight,
    X
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConsumptionLog, Filament } from '../api';
import { api } from '../api';
import AnalyticsCard from '../components/AnalyticsCard';
import { AiInsightBanner } from '../components/AiInsightBanner';
import ColorIndicator from '../components/ColorIndicator';
import DashboardChart from '../components/DashboardChart';
import StockGauge from '../components/StockGauge';
import { useAuth } from '../contexts/AuthContext';
import { checkIsLowStock, getFilamentTitle } from '../utils/filament-utils';



// Dashboard Page
export default function DashboardPage() {
    const { t } = useTranslation();
    const { user, isLoading: authLoading } = useAuth();
    const theme = useTheme();
    const [filaments, setFilaments] = useState<Filament[]>([]);
    const [history, setHistory] = useState<ConsumptionLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [restricted, setRestricted] = useState(false);
    const [showRiskAnalysis, setShowRiskAnalysis] = useState(() => localStorage.getItem('hideRiskAnalysis') !== 'true');

    // Removed unused isSuperAdmin

    const [organization, setOrganization] = useState<any>(null);

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
                // fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/organizations/${orgId}`, {
                //     headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`,'x-organization-id': orgId }
                // }).then(res => res.json()).catch(() => null)
            ]);
            setFilaments(filamentsData || []);
            // Support both array (old) and object (new) format
            if (Array.isArray(historyData)) {
                setHistory(historyData);
                setRestricted(false);
            } else if (historyData && Array.isArray((historyData as any).logs)) {
                setHistory((historyData as any).logs);
                setRestricted((historyData as any).restricted === true);
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

    const [viewMode, setViewMode] = useState<'weight' | 'cost'>('weight');
    const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('day');
    const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

    // ... existing useEffect ...

    // ... loadData ... 

    // Calculations
    const {
        groupedFilaments,
        totalVirtualWeight,
        totalPhysicalWeight,
        totalPlannedWeight,
        totalPhysicalValue,
        totalPlannedValue
    } = useMemo(() => {
        const groups: Record<string, {
            id: string;
            displayName: string;
            brand: string;
            type: string;
            weightRemaining: number;
            weightInitial: number;
            plannedWeight: number;
            virtualWeightRemaining: number;
            color: string;
            colors: string[];
        }> = {};

        const totalPlanned = history.filter(l => l.is_planned).reduce((sum, l) => sum + l.amount, 0);
        let totalPhysical = 0;
        let totalPhysVal = 0;
        let totalPlanVal = 0;

        // Pre-calculate planned weights and values per filament ID to avoid O(N*M)
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
                    id: key,
                    displayName: title,
                    brand: f.brand?.name || 'Unknown',
                    type: f.type?.name || 'Unknown',
                    weightRemaining: 0,
                    weightInitial: 0,
                    plannedWeight: 0,
                    virtualWeightRemaining: 0,
                    color: f.color,
                    colors: colors
                };
            }
            groups[key].weightRemaining += f.weightRemaining;
            groups[key].weightInitial += f.weightInitial;

            const plannedData = plannedByFilament[f.id] || { amount: 0, value: 0 };
            const groupPlanned = plannedData.amount;

            groups[key].plannedWeight += groupPlanned;
            groups[key].virtualWeightRemaining += (f.weightRemaining - groupPlanned);
            totalPhysical += f.weightRemaining;

            // Value calculations
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
        // 1. Map current stock by group
        const stockMap: Record<string, number> = {};
        filaments.forEach(f => {
            const title = getFilamentTitle(f);
            const colors = f.colors || [];
            const key = `${title}-${f.color}-${colors.join(',')}`;

            if (!stockMap[key]) stockMap[key] = 0;
            stockMap[key] += f.weightRemaining;
        });

        // 2. Map Consumption
        const consumptionMap: Record<string, {
            id: string;
            displayName: string;
            brand: string;
            type: string;
            color: string;
            colors: string[];
            amount: number;
            plannedAmount: number;
            cost: number;
            plannedCost: number;
            stock: number;
        }> = {};

        history.forEach(log => {
            const title = getFilamentTitle(log.filament);
            const colors = log.filament?.colors || [];
            const color = log.filament?.color || '';
            const key = `${title}-${color}-${colors.join(',')}`;

            if (!consumptionMap[key]) {
                consumptionMap[key] = {
                    id: key,
                    displayName: title,
                    brand: log.filament?.brand?.name || 'Unknown',
                    type: log.filament?.type?.name || 'Unknown',
                    color: color,
                    colors: colors,
                    amount: 0,
                    plannedAmount: 0,
                    cost: 0,
                    plannedCost: 0,
                    stock: stockMap[key] || 0
                };
            }

            // Calculate Cost
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

        // Convert to array and sort by total amount (actual + planned) desc
        return Object.values(consumptionMap)
            .sort((a, b) => (b.amount + b.plannedAmount) - (a.amount + a.plannedAmount))
            .slice(0, 5);
    }, [history, filaments]);

    // Format Date Helpers
    const getWeekNumber = (d: Date) => {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayNum = date.getUTCDay() || 7;
        date.setUTCDate(date.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    };

    // Helper to adjust color for better UI visualization
    const adjustColor = (color: string, amount: number) => {
        if (!color) return stringToColor('gray');

        let hex = color.startsWith('#') ? color.replace('#', '') : color;
        if (hex.length === 3) hex = hex.split('').map(char => char + char).join('');
        if (hex.length !== 6) return stringToColor(color); // Fallback

        const num = parseInt(hex, 16);
        let r = (num >> 16);
        let g = ((num >> 8) & 0x00FF);
        let b = (num & 0x0000FF);

        // 1. Normalize "Extreme" Colors (Too dark or too light)
        // Approximate luminance
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

        if (lum < 40) { // Too black
            const boost = 40 - lum;
            r += boost; g += boost; b += boost;
            // Make it cool gray
            b += 10;
        } else if (lum > 200) { // Too white (Standard white is 255)
            const darken = lum - 200;
            r -= darken; g -= darken; b -= darken;
        }

        // 2. Apply Variation (Amount)
        r = r + amount;
        g = g + amount;
        b = b + amount;

        // Clamp
        r = Math.min(255, Math.max(0, r));
        g = Math.min(255, Math.max(0, g));
        b = Math.min(255, Math.max(0, b));

        return `#${((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1)}`;
    };

    // Hash function fallback
    const stringToColor = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const c = (hash & 0x00ffffff).toString(16).toUpperCase();
        return '#' + '00000'.substring(0, 6 - c.length) + c;
    };

    const { chartData, chartKeys, colorMap } = useMemo(() => {
        const aggregated: Record<string, Record<string, number>> = {};
        const keys = new Set<string>();
        const keyColorMap: Record<string, string> = {};
        const baseColorCounts: Record<string, number> = {};

        // Filter based on range
        const now = new Date();
        let cutoff = new Date();

        if (timeRange === 'day') cutoff.setDate(now.getDate() - 90); // Last 90 days
        if (timeRange === 'week') cutoff.setDate(now.getDate() - (52 * 7)); // Last year (52 weeks)
        if (timeRange === 'month') cutoff = new Date(0); // All time

        const dateSortMap: Record<string, number> = {};

        history.forEach(log => {
            const logDate = new Date(log.date);
            if (logDate < cutoff) return;

            let dateKey = '';
            // Determine aggregation key
            if (timeRange === 'day') {
                dateKey = logDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            } else if (timeRange === 'week') {
                const week = getWeekNumber(logDate);
                // Prepend Year to week for correct sorting across years if needed, 
                // but for simplistic sort we rely on timestamp
                dateKey = `W${week}`;
            } else {
                dateKey = logDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
            }

            // Store earliest timestamp for this key
            if (!dateSortMap[dateKey] || logDate.getTime() < dateSortMap[dateKey]) {
                dateSortMap[dateKey] = logDate.getTime();
            }

            const filamentName = getFilamentTitle(log.filament);
            const plannedSuffix = ` (${t('consumption.isPlanned', 'Planifié')})`;
            const plannedKey = `${filamentName}${plannedSuffix}`;

            // Handle Color Mapping
            if (!keyColorMap[filamentName]) {
                const baseColor = (log.filament?.colors && log.filament.colors.length > 0)
                    ? log.filament.colors[0]
                    : (log.filament?.color?.startsWith('#') ? log.filament.color : null);

                if (baseColor) {
                    // Normalize base color key
                    const baseKey = baseColor.toUpperCase();
                    if (!baseColorCounts[baseKey]) baseColorCounts[baseKey] = 0;

                    const occurrence = baseColorCounts[baseKey];
                    baseColorCounts[baseKey]++;

                    // Calculate variance: Vary lightness/hue significantly for each occurrence
                    // e.g. 0, +20, -20, +40, -40
                    const step = 25;
                    const direction = occurrence % 2 === 0 ? 1 : -1;
                    const magnitude = Math.ceil(occurrence / 2) * step;
                    const variance = direction * magnitude;

                    keyColorMap[filamentName] = adjustColor(baseColor, variance);
                    // Lighten the planned color
                    keyColorMap[plannedKey] = adjustColor(baseColor, variance + 40);
                } else {
                    keyColorMap[filamentName] = stringToColor(filamentName);
                    keyColorMap[plannedKey] = stringToColor(plannedKey);
                }
            }

            if (!aggregated[dateKey]) aggregated[dateKey] = {};

            const targetKey = log.is_planned ? plannedKey : filamentName;
            if (!aggregated[dateKey][targetKey]) aggregated[dateKey][targetKey] = 0;

            let value = log.amount;
            if (viewMode === 'cost') {
                // Calculate cost: (amount / weightInitial) * price
                const price = log.filament?.price || 0;
                const weightInitial = log.filament?.weightInitial || 1000;
                const pricePerGram = price / weightInitial;
                value = log.amount * pricePerGram;
            }

            aggregated[dateKey][targetKey] += value;
            keys.add(targetKey);
        });

        // Sort keys to ensure planned is always next to actual
        const sortedKeys = Array.from(keys).sort((a, b) => {
            const baseA = a.replace(/ \(Planifié\)$/, '');
            const baseB = b.replace(/ \(Planifié\)$/, '');
            if (baseA === baseB) {
                return a.includes('(') ? 1 : -1; // Actual first, then planned
            }
            return baseA.localeCompare(baseB);
        });

        const data = Object.entries(aggregated)
            .map(([date, values]) => ({ date, ...values }))
            .sort((a, b) => dateSortMap[a.date] - dateSortMap[b.date]);

        return { chartData: data, chartKeys: sortedKeys, colorMap: keyColorMap };

        // improved sort
        // map dateKey back to comparable if possible, or just string sort for now (imperfect for Week/Month mixing years)
        // For MVP:
        // Day: Date sort
        // Month: Date sort
        // Week: String sort might fail (W1 vs W10).
        // Let's rely on simple string sort for now or better manual sort if needed.
        // Actually, let's try to preserve order by building a map of all expected dates.

        return { chartData: data, chartKeys: Array.from(keys), colorMap: keyColorMap };
    }, [history, timeRange, viewMode]);

    const lowStockFilaments = filaments.filter(f => f.weightRemaining > 0 && checkIsLowStock(f, organization));

    // Analytics Calculations
    // Reuse topConsumptionGroups for the most consumed card
    const topConsumedGroup = topConsumptionGroups.length > 0 ? topConsumptionGroups[0] : null;
    const topConsumedValue = topConsumedGroup ? `${Math.round(topConsumedGroup.amount)}g` : '0g';

    // Shortage Prediction
    // Simple logic: Total Virtual Weight / Avg Daily Consumption (last 30 days)
    const daysRemaining = useMemo(() => {
        if (totalVirtualWeight <= 0) return 0;

        // Avg daily consumption over last 30 days
        const now = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);

        let totalConsumed30d = 0;
        history.forEach(log => {
            // Only count non-planned consumption for base flow rate?
            // Actually, if we use history to predict, we should use actual usage.
            if (!log.is_planned && new Date(log.date) >= thirtyDaysAgo) {
                totalConsumed30d += log.amount;
            }
        });

        const avgDaily = totalConsumed30d / 30;
        if (avgDaily <= 0) return 999; // Infinite

        return Math.round(totalVirtualWeight / avgDaily);
    }, [totalVirtualWeight, history]);


    const formatRemainingTime = (days: number): string => {
        if (days < 365) {
            return `${days} jours`;
        }

        const years = Math.floor(days / 365);
        const months = Math.floor((days % 365) / 30);
        return `${years} an${years > 1 ? 's' : ''}${months > 0 ? ` ${months} mois` : ''
            }`;
    };

    // Risk Prediction (Smart Forecast)
    const riskyGroups = useMemo(() => {
        if (history.length === 0) return [];

        return topConsumptionGroups.filter(g => {
            // 1. Calculate local 30-day rate for this group
            const now = new Date();
            const cutoff = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

            const groupLogs = history.filter(h => {
                const title = getFilamentTitle(h.filament);
                const color = h.filament?.color || '';
                const key = `${title}-${color}-${(h.filament?.colors || []).join(',')}`;
                return key === g.id && new Date(h.date) >= cutoff;
            });

            const used30d = groupLogs.reduce((sum, l) => sum + l.amount, 0);
            if (used30d === 0) return false;

            const dailyRate = used30d / 30;
            const daysLeft = g.stock / dailyRate;

            return daysLeft < 30; // Risk if runs out in < 30 days
        }).map(g => {
            // Calculate specifics for display
            const now = new Date();
            const cutoff = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
            const groupLogs = history.filter(h => {
                const title = getFilamentTitle(h.filament);
                const color = h.filament?.color || '';
                const key = `${title}-${color}-${(h.filament?.colors || []).join(',')}`;
                return key === g.id && new Date(h.date) >= cutoff;
            });
            const used30d = groupLogs.reduce((sum, l) => sum + l.amount, 0);
            const dailyRate = used30d / 30;
            const daysLeft = Math.round(g.stock / dailyRate);
            return { ...g, daysLeft };
        });
    }, [topConsumptionGroups, history]);

    const recentActivities = useMemo(() => {
        const activities: any[] = [];

        // 1. Consumption Logs
        history.forEach(log => {
            activities.push({
                id: `log-${log.id}`,
                type: 'consumption',
                date: new Date(log.date),
                amount: log.amount,
                filament: log.filament,
                isPlanned: log.is_planned,
                notes: log.notes
            });
        });

        // 2. Filament Creations
        filaments.forEach(f => {
            if (f.createdAt) {
                activities.push({
                    id: `create-${f.id}`,
                    type: 'creation',
                    date: new Date(f.createdAt),
                    filament: f
                });
            }
        });

        return activities
            .sort((a, b) => b.date.getTime() - a.date.getTime())
            .slice(0, 10);
    }, [history, filaments]);

    if (loading) return <LinearProgress />;

    return (
        <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
                <AiInsightBanner plan={organization?.plan} trialEndsAt={organization?.trialEndsAt} />
            </Grid>

            {/* ... Alerts ... */}
            {(lowStockFilaments.length > 0 || riskyGroups.length > 0) && showRiskAnalysis && (
                <Grid size={{ xs: 12 }}>
                    <Card sx={{ bgcolor: 'rgba(239, 68, 68, 0.05)', border: '1px solid', borderColor: 'error.main', position: 'relative', overflow: 'hidden' }}>
                        {!((organization?.plan === 'pro' || organization?.plan === 'enterprise' || organization?.plan === 'beta') || (organization?.trialEndsAt && new Date(organization.trialEndsAt) > new Date())) && (
                            <Box sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                bgcolor: 'rgba(255, 255, 255, 0.7)',
                                backdropFilter: 'blur(4px)',
                                zIndex: 10,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 2
                            }}>
                                <Typography variant="h6" fontWeight="bold">{t('dashboard.proFeature', '👑 Fonctionnalité Pro')}</Typography>
                                <Typography variant="body2" color="text.secondary">{t('dashboard.upgradeToProRisk', 'Passez au plan Pro pour l\'analyse de risque IA.')}</Typography>
                                {!organization?.trialEndsAt && (
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        onClick={async () => {
                                            try {
                                                const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/stripe/create-checkout-session`, {
                                                    method: 'POST',
                                                    headers: {
                                                        'Content-Type': 'application/json',
                                                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                                                        'x-organization-id': organization.id.toString()
                                                    },
                                                    body: JSON.stringify({
                                                        plan: 'pro',
                                                        organizationId: organization.id
                                                    })
                                                });

                                                if (res.ok) {
                                                    const { url } = await res.json();
                                                    window.location.href = url;
                                                } else {
                                                    const data = await res.json().catch(() => ({}));
                                                    alert(t('dashboard.trialError', data.message || 'Erreur lors du démarrage de l\'essai.'));
                                                }
                                            } catch (e) {
                                                console.error(e);
                                                alert(t('dashboard.trialError', 'Erreur lors du démarrage de l\'essai.'));
                                            }
                                        }}
                                    >
                                        {t('dashboard.startTrial', { trialDays: import.meta.env.VITE_DEFAULT_TRIAL_DAYS || 14, defaultValue: `Démarrer l'essai gratuit (${import.meta.env.VITE_DEFAULT_TRIAL_DAYS || 14}j)` })}
                                    </Button>
                                )}
                            </Box>
                        )}
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <AlertTriangle color={theme.palette.error.main} />
                                    <Typography variant="h6" fontWeight="bold" color="error.main">
                                        {t('dashboard.smartRiskAnalysis', 'Analyse de Risque IA')}
                                    </Typography>
                                </Box>
                                <IconButton
                                    size="small"
                                    onClick={() => { setShowRiskAnalysis(false); localStorage.setItem('hideRiskAnalysis', 'true'); }}
                                    aria-label="close"
                                >
                                    <X size={18} />
                                </IconButton>
                            </Box>

                            {/* Low Stock (Static Threshold) */}
                            {lowStockFilaments.length > 0 && (
                                <Box mb={2}>
                                    <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                                        {t('dashboard.lowStockBase', 'Stock faible (Basé sur le seuil)')}
                                    </Typography>
                                    <Typography variant="body2" color="textSecondary">
                                        {lowStockFilaments.map(f => `${getFilamentTitle(f)} (${f.weightRemaining.toFixed(2)}g)`).join(', ')}
                                    </Typography>
                                </Box>
                            )}

                            {/* AI Prediction Risks */}
                            <Box>
                                <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                                    {t('dashboard.highDepletionRisk', 'Risque élevé d\'épuisement (Prochains 30 Jours)')}
                                </Typography>
                                {Array.isArray(riskyGroups) && riskyGroups.length === 0 ? (
                                    <Typography variant="body2" color="success.main">{t('dashboard.noHighRisk', 'Aucun filament à risque élevé détecté selon votre consommation récente.')}</Typography>
                                ) : (
                                    <Box display="flex" flexWrap="wrap" gap={1}>
                                        {Array.isArray(riskyGroups) && riskyGroups.map((g: any) => (
                                            <Chip
                                                key={g.id}
                                                label={`${g.displayName} (${t('dashboard.daysLeft', { count: g.daysLeft, defaultValue: `${g.daysLeft} jours restants` })})`}
                                                color="warning" // Orange
                                                size="small"
                                                icon={<TrendingUp size={14} />}
                                            />
                                        ))}
                                    </Box>
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            )
            }

            {/* Analytics Section (Top Row) */}
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
                    title={t('dashboard.favoriteFilament')} // "Most Consumed" -> "Filament Favori"
                    value={topConsumedValue}
                    icon={TrendingUp}
                    gradient="linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)"
                    subtitle={
                        topConsumedGroup ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <ColorIndicator colors={topConsumedGroup.colors || []} primaryColor={topConsumedGroup.color} size={16} />
                                <Typography variant="caption" sx={{ color: 'white', opacity: 0.9 }}>
                                    {topConsumedGroup.displayName}
                                </Typography>
                            </Box>
                        ) : t('common.none')
                    }
                />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <AnalyticsCard
                    title={t('dashboard.estRunway')}
                    value={restricted ? "PRO" : formatRemainingTime(daysRemaining)}
                    icon={Calendar}
                    gradient={restricted ? "linear-gradient(135deg, #2c3e50 0%, #4ca1af 100%)" : (daysRemaining < 14 ? "linear-gradient(135deg, #cb2d3e 0%, #ef473a 100%)" : "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)")}
                    subtitle={
                        restricted ? "Disponible avec le plan Pro" : (
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
                        (lowStockFilaments.length > 0 || (Array.isArray(riskyGroups) && riskyGroups.length > 0)) ? (
                            <IconButton
                                size="small"
                                onClick={() => {
                                    const next = !showRiskAnalysis;
                                    setShowRiskAnalysis(next);
                                    localStorage.setItem('hideRiskAnalysis', next ? 'false' : 'true');
                                }}
                                sx={{ color: 'white', opacity: 0.8, '&:hover': { opacity: 1 } }}
                            >
                                {showRiskAnalysis ? <EyeOff size={20} /> : <Eye size={20} />}
                            </IconButton>
                        ) : undefined
                    }
                />
            </Grid>

            {/* Charts Section */}
            <Grid size={{ xs: 12, md: 8 }}>
                <Card sx={{ height: '100%' }}>
                    <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h3">
                                {t('dashboard.consumptionTrend')}
                            </Typography>
                            {!restricted && (
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <ToggleButtonGroup
                                        value={chartType}
                                        exclusive
                                        onChange={(_, v) => v && setChartType(v)}
                                        size="small"
                                    >
                                        <ToggleButton value="bar">Barres</ToggleButton>
                                        <ToggleButton value="line">Lignes</ToggleButton>
                                    </ToggleButtonGroup>

                                    <ToggleButtonGroup
                                        value={timeRange}
                                        exclusive
                                        onChange={(_, v) => v && setTimeRange(v)}
                                        size="small"
                                    >
                                        <ToggleButton value="day">Jour</ToggleButton>
                                        <ToggleButton value="week">Sem</ToggleButton>
                                        <ToggleButton value="month">Mois</ToggleButton>
                                    </ToggleButtonGroup>
                                    <ToggleButtonGroup
                                        value={viewMode}
                                        exclusive
                                        onChange={(_, v) => v && setViewMode(v)}
                                        size="small"
                                    >
                                        <ToggleButton value="weight">Poids</ToggleButton>
                                        <ToggleButton value="cost">Coût</ToggleButton>
                                    </ToggleButtonGroup>
                                </Box>
                            )}
                        </Box>

                        {restricted ? (
                            <Box sx={{ height: 350, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 2 }}>
                                <Typography variant="h5" gutterBottom>{t('dashboard.analyticsPro', '👑 Statistiques Pro')}</Typography>
                                <Typography color="textSecondary" align="center" sx={{ maxWidth: 400, mb: 2 }}>
                                    {t('dashboard.upgradeToProAnalytics', 'Passez au plan Pro pour visualiser les tendances de consommation, les coûts et les prévisions avancées.')}
                                </Typography>
                            </Box>
                        ) : (
                            <Box sx={{ height: 350, width: '100%', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {chartData.length > 0 ? (
                                    <DashboardChart data={chartData} keys={chartKeys} viewMode={viewMode} colorMap={colorMap} chartType={chartType} />
                                ) : (
                                    <Typography color="textSecondary">
                                        {t('dashboard.noConsumptionData', 'Aucune donnée de consommation disponible')}
                                    </Typography>
                                )}
                            </Box>
                        )}
                    </CardContent>
                </Card>
            </Grid>

            {/* Top Consumption / List */}
            <Grid size={{ xs: 12, md: 4 }}>
                <Card sx={{ height: '100%' }}>
                    <CardContent>
                        <Typography variant="h3" gutterBottom>
                            {t('dashboard.topConsumption')}
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {topConsumptionGroups.map(group => (
                                <Box key={group.id} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <ColorIndicator colors={group.colors} primaryColor={group.color} size={32} />
                                    <Box sx={{ flex: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Typography variant="subtitle2" noWrap>{group.displayName}</Typography>
                                            {group.plannedAmount > 0 && (
                                                <Tooltip title={`${group.plannedAmount.toFixed(0)}g planifiés`}>
                                                    <CalendarClock size={14} color={theme.palette.warning.main} />
                                                </Tooltip>
                                            )}
                                        </Box>
                                        <Typography variant="caption" color="textSecondary">{group.brand}</Typography>
                                    </Box>
                                    <Box sx={{ textAlign: 'right' }}>
                                        <Typography variant="body2" fontWeight="bold" color="text.primary">
                                            {t('dashboard.stock', 'Stock')}: {group.stock.toFixed(2)}g
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                            {group.plannedAmount > 0 ? (
                                                <>
                                                    {t('dashboard.conso', 'Conso')}: {Math.round(group.amount)}g | {t('dashboard.plannedShort', 'Planifié')}: {Math.round(group.plannedAmount)}g
                                                </>
                                            ) : (
                                                <>{t('dashboard.conso', 'Conso')}: {Math.round(group.amount)}g</>
                                            )}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                            {t('dashboard.cost', 'Coût')}: {group.cost.toFixed(2)}€
                                            {group.plannedCost > 0 && (
                                                <span style={{ color: '#6366f1', marginLeft: 8 }}>
                                                    ({t('dashboard.plannedShort', 'P')} : {group.plannedCost.toFixed(2)}€)
                                                </span>
                                            )}
                                        </Typography>
                                    </Box>
                                </Box>
                            ))}
                            {filaments.length === 0 && (
                                <Typography variant="body2" color="textSecondary">{t('common.none', 'Aucune donnée disponible.')}</Typography>
                            )}
                        </Box>
                    </CardContent>
                </Card>
            </Grid>

            {/* Bottom Row: Stock Overview & Recent Activity */}
            <Grid size={{ xs: 12, lg: 8 }}>
                <Typography variant="h3" sx={{ mb: 3, mt: 1 }}>
                    {t('dashboard.stockOverview')}
                </Typography>
                <Grid container spacing={2}>
                    {groupedFilaments.map(group => (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={group.id}>
                            <Card sx={{ height: '100%' }}>
                                <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 2 }}>
                                    <Box sx={{ mb: 2 }}>
                                        <StockGauge
                                            value={(group.weightRemaining / group.weightInitial) * 100}
                                            plannedValue={(group.plannedWeight / group.weightInitial) * 100}
                                            label={`${Math.round((group.weightRemaining / group.weightInitial) * 100)}%`}
                                            color={group.color}
                                            colors={group.colors}
                                            physicalWeight={group.weightRemaining}
                                            plannedWeightRaw={group.plannedWeight}
                                        />
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="h4" gutterBottom>{group.weightRemaining.toFixed(0)}g</Typography>
                                        {group.plannedWeight > 0 && (
                                            <Tooltip title={`${group.plannedWeight.toFixed(0)}g planifiés`}>
                                                <CalendarClock size={20} color={theme.palette.warning.main} />
                                            </Tooltip>
                                        )}
                                    </Box>
                                    <Typography variant="subtitle2" noWrap title={group.displayName} sx={{ maxWidth: '100%', textAlign: 'center' }}>
                                        {group.displayName}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </Grid>

            {/* Recent Activity Section */}
            <Grid size={{ xs: 12, lg: 4 }}>
                <Typography variant="h3" sx={{ mb: 3, mt: 1 }}>
                    {t('dashboard.recentActivity')}
                </Typography>
                <Card sx={{ height: 'calc(100% - 48px)', maxHeight: 600, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <CardContent sx={{ flex: 1, overflowY: 'auto', p: 0 }}>
                        {recentActivities.length === 0 ? (
                            <Box sx={{ p: 4, textAlign: 'center' }}>
                                <Typography color="textSecondary">{t('dashboard.noActivity')}</Typography>
                            </Box>
                        ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                {recentActivities.map((activity, index) => {
                                    const filament = activity.filament;
                                    const title = getFilamentTitle(filament);
                                    const date = activity.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

                                    return (
                                        <Box key={activity.id}>
                                            <Box sx={{ p: 2, display: 'flex', alignItems: 'flex-start', gap: 2, '&:hover': { bgcolor: 'rgba(0,0,0,0.02)' } }}>
                                                <Box sx={{ mt: 0.5 }}>
                                                    <ColorIndicator
                                                        colors={filament?.colors || []}
                                                        primaryColor={filament?.color}
                                                        size={32}
                                                    />
                                                </Box>
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                                                            {activity.type === 'creation' ? (
                                                                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                    <Sparkles size={14} color={theme.palette.primary.main} /> {title}
                                                                </Box>
                                                            ) : (
                                                                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                    <PencilRuler size={14} color={theme.palette.warning.main} /> {title}
                                                                </Box>
                                                            )}
                                                        </Typography>
                                                        <Typography variant="caption" color="textSecondary" sx={{ ml: 1, flexShrink: 0 }}>
                                                            {date}
                                                        </Typography>
                                                    </Box>
                                                    <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                                                        {filament?.brand?.name} • {filament?.material?.name}
                                                    </Typography>
                                                    {activity.type === 'consumption' && (
                                                        <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <Typography variant="body2" sx={{ color: activity.isPlanned ? theme.palette.warning.main : theme.palette.error.main, fontWeight: 700 }}>
                                                                -{Math.round(activity.amount)}g
                                                                {activity.isPlanned && <span style={{ fontSize: '0.8em', fontWeight: 400, marginLeft: 4 }}>({t('dashboard.planned')})</span>}
                                                            </Typography>
                                                            {activity.notes && (
                                                                <Typography variant="caption" color="textSecondary" noWrap sx={{ maxWidth: '60%', fontStyle: 'italic' }}>
                                                                    "{activity.notes}"
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    )}
                                                    {activity.type === 'creation' && (
                                                        <Typography variant="body2" sx={{ color: theme.palette.primary.main, fontWeight: 700, mt: 0.5 }}>
                                                            +{filament?.weightInitial}g
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </Box>
                                            {index < recentActivities.length - 1 && <Divider />}
                                        </Box>
                                    );
                                })}
                            </Box>
                        )}
                    </CardContent>
                    <Divider />
                    <Box sx={{ p: 1, textAlign: 'center' }}>
                        <Button size="small" startIcon={<History size={16} />} href="/consumption">
                            {t('dashboard.viewAll')}
                        </Button>
                    </Box>
                </Card>
            </Grid>
        </Grid>
    );
}
