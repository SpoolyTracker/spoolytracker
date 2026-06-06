import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bell, ExternalLink, ShoppingCart, Sparkles } from 'lucide-react';
import {
    Box,
    Button,
    Card,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Stack,
    Typography,
} from '@mui/material';
import { aiEngine, type ReplenishmentResponse } from '../api';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AiInsightBannerProps {
    plan?: 'free' | 'pro' | 'enterprise' | 'beta';
    trialEndsAt?: string | null;
}

interface MaterialRisk {
    item_name?: string | null;
    brand?: string | null;
    material: string;
    material_type?: string | null;
    color?: string | null;
    color_name?: string | null;
    color_hex?: string | null;
    risk_level: string;
    reason: string;
    affected_items?: string[];
    confidence_score: number;
}

interface ProjectRisk {
    project_id?: string;
    project_name: string;
    risk_level: string;
    reason: string;
    missing_materials?: string[];
    confidence_score: number;
}

interface NotificationProposal {
    type?: string;
    title: string;
    message: string;
    priority: string;
    related_item_id?: string | null;
}

const riskColor = (level: string) => {
    if (level === 'critical' || level === 'high') return 'warning';
    if (level === 'medium') return 'info';
    return 'default';
};

const riskLabel = (level: string) => {
    if (level === 'critical') return 'Critique';
    if (level === 'high') return 'Haut';
    if (level === 'medium') return 'Moyen';
    if (level === 'low') return 'Faible';
    if (level === 'unknown') return 'A completer';
    return level;
};

const isHexColor = (value?: string | null) => Boolean(value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value));

const cleanAiText = (value?: string | null) => (
    (value || '')
        .replace(/\s*#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/gi, '')
        .replace(/\s*couleur personnalis(?:e|ee|ée|Ã©e)/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
);

const ColorSwatch = ({ color }: { color?: string | null }) => {
    if (!isHexColor(color)) return null;
    return (
        <Box
            component="span"
            aria-label="Couleur du filament"
            sx={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                bgcolor: color!,
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.55)',
                flexShrink: 0,
            }}
        />
    );
};

const FilamentIdentity = ({ risk }: { risk: MaterialRisk }) => {
    const colorHex = risk.color_hex || (isHexColor(risk.color) ? risk.color : null);
    const colorName = cleanAiText(risk.color_name || (!isHexColor(risk.color) ? risk.color : ''));
    const parts = [
        cleanAiText(risk.brand),
        cleanAiText(risk.material),
        cleanAiText(risk.material_type),
    ].filter(Boolean);

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}>
            {parts.map((part, index) => (
                <Typography
                    key={`${part}-${index}`}
                    component="span"
                    variant="body2"
                    fontWeight={index === 0 ? 700 : 800}
                    color={index === 0 ? 'text.secondary' : 'text.primary'}
                >
                    {part}
                </Typography>
            ))}
            <ColorSwatch color={colorHex} />
            {colorName && (
                <Typography component="span" variant="body2" fontWeight={700}>
                    {colorName}
                </Typography>
            )}
        </Box>
    );
};

const anomalyDateFromMessage = (message: string) => {
    const match = message.match(/\b\d{4}-\d{2}-\d{2}\b/);
    return match?.[0] || null;
};

const notificationTargetPath = (notification: NotificationProposal) => {
    if (!notification.related_item_id) return null;
    const params = new URLSearchParams({ aiItem: notification.related_item_id });
    if (notification.type === 'anomaly') {
        params.set('aiOpen', 'history');
        const anomalyDate = anomalyDateFromMessage(notification.message);
        if (anomalyDate) params.set('aiDate', anomalyDate);
    }
    return `/inventory?${params.toString()}`;
};

const canReplenishNotification = (notification: NotificationProposal) => (
    Boolean(notification.related_item_id) &&
    (notification.type === 'depletion' ||
        notification.type === 'low_stock' ||
        /rupture|stock|commande|bobine/i.test(`${notification.title} ${notification.message}`))
);

const canReplenishRisk = (risk: MaterialRisk) => (
    Boolean(risk.affected_items?.[0]) &&
    (risk.risk_level === 'critical' || risk.risk_level === 'high') &&
    risk.confidence_score >= 0.5
);

export const AiInsightBanner: React.FC<AiInsightBannerProps> = ({ plan = 'free', trialEndsAt }) => {
    const [loading, setLoading] = useState(false);
    const [materialRisks, setMaterialRisks] = useState<MaterialRisk[]>([]);
    const [projectRisks, setProjectRisks] = useState<ProjectRisk[]>([]);
    const [notifications, setNotifications] = useState<NotificationProposal[]>([]);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [unavailable, setUnavailable] = useState(false);
    const [dataSource, setDataSource] = useState<string | null>(null);
    const [includeEmptySpools, setIncludeEmptySpools] = useState(false);
    const navigate = useNavigate();

    const isProEligible = useMemo(() => {
        return plan === 'pro' || plan === 'enterprise' || plan === 'beta' || Boolean(trialEndsAt && new Date(trialEndsAt) > new Date());
    }, [plan, trialEndsAt]);

    const riskCount = materialRisks.length + projectRisks.length;
    useEffect(() => {
        localStorage.setItem('organization_plan', isProEligible ? 'pro' : 'free');
        if (!isProEligible) return;

        let isMounted = true;
        setLoading(true);
        Promise.all([
            aiEngine.risks('pro', includeEmptySpools),
            aiEngine.notificationProposals('pro', includeEmptySpools),
        ])
            .then(([risks, notificationResponse]) => {
                if (!isMounted) return;
                setMaterialRisks(risks.material_risks || []);
                setProjectRisks(risks.project_risks || []);
                setNotifications(notificationResponse.proposals || []);
                setDataSource(risks.source || notificationResponse.source || null);
                setUnavailable(false);
            })
            .catch(() => {
                if (!isMounted) return;
                setUnavailable(true);
                setDataSource(null);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [isProEligible, includeEmptySpools]);

    if (!isProEligible) {
        return (
            <Card variant="outlined" sx={{ p: 2, bgcolor: 'rgba(245, 158, 11, 0.08)', borderColor: 'warning.light' }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                        <Sparkles size={20} />
                        <Box>
                            <Typography variant="subtitle2" fontWeight={700}>Assistant IA Free actif</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Le chat peut aider sur le stock, les projets et les consommations. Les previsions et risques detailles sont en Pro.
                            </Typography>
                        </Box>
                    </Box>
                    <Chip label="Mode Free" color="default" size="small" />
                </Stack>
            </Card>
        );
    }

    return (
        <Card variant="outlined" sx={{ p: 2, bgcolor: 'rgba(22, 97, 175, 0.06)', borderColor: 'primary.light' }}>
            <Stack spacing={1.5}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                        {loading ? <CircularProgress size={20} /> : <Sparkles size={20} />}
                        <Box>
                            <Typography variant="subtitle2" fontWeight={700}>Assistant IA Pro connecte</Typography>
                            <Typography variant="body2" color="text.secondary">
                                {unavailable
                                    ? "Le moteur IA n'est pas joignable pour le moment."
                                    : dataSource === 'main_api'
                                        ? "Donnees reelles de votre organisation."
                                        : "Mode demo/offline: donnees mockees affichees."}
                            </Typography>
                        </Box>
                    </Box>
                    {!unavailable && (
                        <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center" justifyContent="center">
                            <Chip
                                label={dataSource === 'main_api' ? 'API reelle' : 'Mock'}
                                color={dataSource === 'main_api' ? 'success' : 'warning'}
                                size="small"
                            />
                            <Chip
                                icon={<AlertTriangle size={14} />}
                                label={`${riskCount} risque(s)`}
                                color={riskCount > 0 ? 'warning' : 'success'}
                                size="small"
                                clickable={riskCount > 0}
                                onClick={() => riskCount > 0 && setDetailsOpen(true)}
                            />
                            <Chip
                                icon={<Bell size={14} />}
                                label={`${notifications.length} notification(s)`}
                                color={notifications.length > 0 ? 'info' : 'default'}
                                size="small"
                                clickable={notifications.length > 0}
                                onClick={() => notifications.length > 0 && setDetailsOpen(true)}
                            />
                            {(riskCount + notifications.length) > 0 && (
                                <Button
                                    size="small"
                                    variant="text"
                                    onClick={() => setDetailsOpen(true)}
                                >
                                    Details
                                </Button>
                            )}
                        </Stack>
                    )}
                    {unavailable && <Button size="small" variant="outlined" onClick={() => window.location.reload()}>Reessayer</Button>}
                </Stack>

                {!unavailable && !loading && riskCount === 0 && notifications.length === 0 && (
                    <Typography variant="body2" color="text.secondary">Aucun risque prioritaire detecte pour le moment.</Typography>
                )}
            </Stack>
            <AiDetailsDialog
                open={detailsOpen}
                onClose={() => setDetailsOpen(false)}
                materialRisks={materialRisks}
                projectRisks={projectRisks}
                notifications={notifications}
                includeEmptySpools={includeEmptySpools}
                onToggleIncludeEmptySpools={() => setIncludeEmptySpools(prev => !prev)}
                onNavigate={(path) => {
                    setDetailsOpen(false);
                    navigate(path);
                }}
            />
        </Card>
    );
};

interface AiDetailsDialogProps {
    open: boolean;
    onClose: () => void;
    materialRisks: MaterialRisk[];
    projectRisks: ProjectRisk[];
    notifications: NotificationProposal[];
    includeEmptySpools: boolean;
    onToggleIncludeEmptySpools: () => void;
    onNavigate: (path: string) => void;
}

const AiDetailsDialog: React.FC<AiDetailsDialogProps> = ({
    open,
    onClose,
    materialRisks,
    projectRisks,
    notifications,
    includeEmptySpools,
    onToggleIncludeEmptySpools,
    onNavigate,
}) => {
    const [replenishmentOpen, setReplenishmentOpen] = useState(false);
    const [replenishmentLoading, setReplenishmentLoading] = useState(false);
    const [replenishmentError, setReplenishmentError] = useState<string | null>(null);
    const [replenishment, setReplenishment] = useState<ReplenishmentResponse | null>(null);

    const openReplenishment = async (itemId: string) => {
        setReplenishmentOpen(true);
        setReplenishmentLoading(true);
        setReplenishmentError(null);
        setReplenishment(null);
        try {
            const response = await aiEngine.replenishmentSuggestions(itemId, 'pro');
            setReplenishment(response);
        } catch (error: any) {
            setReplenishmentError(error?.message || 'Impossible de charger les suggestions de commande.');
        } finally {
            setReplenishmentLoading(false);
        }
    };

    return (
        <>
            <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Sparkles size={20} />
                        Details IA Pro
                    </Box>
                    <IconButton size="small" onClick={onClose}>
                        <X size={18} />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2.5}>
                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                            <Button
                                size="small"
                                variant={includeEmptySpools ? 'contained' : 'outlined'}
                                color={includeEmptySpools ? 'warning' : 'inherit'}
                                onClick={onToggleIncludeEmptySpools}
                            >
                                {includeEmptySpools ? 'Bobines vides incluses' : 'Inclure les bobines vides'}
                            </Button>
                        </Box>
                        <Box>
                            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
                                Stocks a risque
                            </Typography>
                            {materialRisks.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">Aucun stock a risque detecte.</Typography>
                            ) : (
                                <Stack spacing={1}>
                                    {materialRisks.map((risk, index) => {
                                        const itemId = risk.affected_items?.[0];
                                        return (
                                            <Card key={`${risk.material}-${risk.color}-${index}`} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                                                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                                                    <Chip
                                                        label={riskLabel(risk.risk_level)}
                                                        color={riskColor(risk.risk_level) as any}
                                                        size="small"
                                                        sx={{ minWidth: 96, justifyContent: 'center' }}
                                                    />
                                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                                        <FilamentIdentity risk={risk} />
                                                        <Typography variant="body2" color="text.secondary">
                                                            {cleanAiText(risk.reason)}
                                                        </Typography>
                                                        {risk.confidence_score >= 0.5 ? (
                                                            <Typography variant="caption" color="text.secondary">
                                                                Confiance {Math.round(risk.confidence_score * 100)}%
                                                            </Typography>
                                                        ) : null}
                                                        {itemId && (
                                                            <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
                                                                <Button
                                                                    size="small"
                                                                    variant="outlined"
                                                                    onClick={() => onNavigate(`/inventory?aiItem=${encodeURIComponent(itemId)}`)}
                                                                >
                                                                    Voir le stock
                                                                </Button>
                                                                {canReplenishRisk(risk) && (
                                                                    <Button
                                                                        size="small"
                                                                        variant="contained"
                                                                        startIcon={<ShoppingCart size={15} />}
                                                                        onClick={() => openReplenishment(itemId)}
                                                                    >
                                                                        Commander
                                                                    </Button>
                                                                )}
                                                            </Stack>
                                                        )}
                                                    </Box>
                                                </Stack>
                                            </Card>
                                        );
                                    })}
                                </Stack>
                            )}
                        </Box>

                        <Box>
                            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
                                Projets a risque
                            </Typography>
                            {projectRisks.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">Aucun projet a risque detecte.</Typography>
                            ) : (
                                <Stack spacing={1}>
                                    {projectRisks.map((risk, index) => (
                                        <Card key={`${risk.project_name}-${index}`} variant="outlined" sx={{ p: 1.5 }}>
                                            <Stack direction="row" spacing={1.5} alignItems="flex-start">
                                                <Chip label={riskLabel(risk.risk_level)} color={riskColor(risk.risk_level) as any} size="small" sx={{ minWidth: 96, justifyContent: 'center' }} />
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Typography variant="body2" fontWeight={700}>{risk.project_name}</Typography>
                                                    <Typography variant="body2" color="text.secondary">{risk.reason}</Typography>
                                                    {risk.missing_materials?.map((material, materialIndex) => (
                                                        <Typography key={materialIndex} variant="caption" display="block" color="text.secondary">
                                                            {material}
                                                        </Typography>
                                                    ))}
                                                    {risk.project_id && (
                                                        <Box sx={{ mt: 1 }}>
                                                            <Button
                                                                size="small"
                                                                variant="outlined"
                                                                onClick={() => onNavigate(`/projects/${encodeURIComponent(risk.project_id!)}`)}
                                                            >
                                                                Ouvrir le projet
                                                            </Button>
                                                        </Box>
                                                    )}
                                                </Box>
                                            </Stack>
                                        </Card>
                                    ))}
                                </Stack>
                            )}
                        </Box>

                        <Box>
                            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
                                Notifications proposees
                            </Typography>
                            {notifications.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">Aucune notification proactive proposee.</Typography>
                            ) : (
                                <Stack spacing={1}>
                                    {notifications.map((notification, index) => (
                                        <Card key={`${notification.title}-${index}`} variant="outlined" sx={{ p: 1.5 }}>
                                            <Stack direction="row" spacing={1.5} alignItems="flex-start">
                                                <Chip icon={<Bell size={13} />} label={riskLabel(notification.priority)} color={riskColor(notification.priority) as any} size="small" sx={{ minWidth: 96, justifyContent: 'center' }} />
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Typography variant="body2" fontWeight={700}>{notification.title}</Typography>
                                                    <Typography variant="body2" color="text.secondary">{notification.message}</Typography>
                                                    <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
                                                        {notificationTargetPath(notification) && (
                                                            <Button
                                                                size="small"
                                                                variant="outlined"
                                                                onClick={() => onNavigate(notificationTargetPath(notification)!)}
                                                            >
                                                                {notification.type === 'anomaly' ? "Voir l'historique" : 'Voir la bobine'}
                                                            </Button>
                                                        )}
                                                        {notification.related_item_id && canReplenishNotification(notification) && (
                                                            <Button
                                                                size="small"
                                                                variant="contained"
                                                                startIcon={<ShoppingCart size={15} />}
                                                                onClick={() => openReplenishment(notification.related_item_id!)}
                                                            >
                                                                Commander
                                                            </Button>
                                                        )}
                                                    </Stack>
                                                </Box>
                                            </Stack>
                                        </Card>
                                    ))}
                                </Stack>
                            )}
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Fermer</Button>
                </DialogActions>
            </Dialog>
            <ReplenishmentDialog
                open={replenishmentOpen}
                loading={replenishmentLoading}
                error={replenishmentError}
                data={replenishment}
                onClose={() => setReplenishmentOpen(false)}
            />
        </>
    );
};

interface ReplenishmentDialogProps {
    open: boolean;
    loading: boolean;
    error: string | null;
    data: ReplenishmentResponse | null;
    onClose: () => void;
}

const relevanceLabel = (relevance: string) => {
    if (relevance === 'exact') return 'Exact';
    if (relevance === 'close_color') return 'Couleur proche';
    return 'Secours';
};

const ReplenishmentDialog: React.FC<ReplenishmentDialogProps> = ({ open, loading, error, data, onClose }) => (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShoppingCart size={20} />
                Commander du filament
            </Box>
            <IconButton size="small" onClick={onClose}>
                <X size={18} />
            </IconButton>
        </DialogTitle>
        <DialogContent dividers>
            {loading && (
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <CircularProgress size={20} />
                    <Typography variant="body2" color="text.secondary">Recherche des meilleures options...</Typography>
                </Stack>
            )}
            {!loading && error && (
                <Typography variant="body2" color="error">{error}</Typography>
            )}
            {!loading && !error && data && (
                <Stack spacing={1.5}>
                    <Typography variant="body2" color="text.secondary">
                        Suggestions pour {data.quantity_kg}kg, pays cible {data.country}. Les liens ouvrent une recherche chez le provider.
                    </Typography>
                    {data.suggestions.map((suggestion) => (
                        <Card key={`${suggestion.provider_id}-${suggestion.query}`} variant="outlined" sx={{ p: 1.5 }}>
                            <Stack spacing={1}>
                                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography variant="body2" fontWeight={800}>{suggestion.provider_name}</Typography>
                                        <Typography variant="caption" color="text.secondary">{suggestion.query}</Typography>
                                    </Box>
                                    <Chip
                                        size="small"
                                        color={suggestion.relevance === 'exact' ? 'success' : suggestion.relevance === 'close_color' ? 'info' : 'default'}
                                        label={`${suggestion.score}% - ${relevanceLabel(suggestion.relevance)}`}
                                    />
                                </Stack>
                                <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                                    {suggestion.matched_color.hex && <ColorSwatch color={suggestion.matched_color.hex} />}
                                    <Typography variant="caption" color="text.secondary">
                                        Couleur: {suggestion.matched_color.name}
                                    </Typography>
                                </Stack>
                                <Box>
                                    {suggestion.reasons.map((reason) => (
                                        <Typography key={reason} variant="caption" display="block" color="text.secondary">
                                            {reason}
                                        </Typography>
                                    ))}
                                </Box>
                                <Box>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        endIcon={<ExternalLink size={14} />}
                                        onClick={() => window.open(suggestion.url, '_blank', 'noopener,noreferrer')}
                                    >
                                        Ouvrir
                                    </Button>
                                </Box>
                            </Stack>
                        </Card>
                    ))}
                </Stack>
            )}
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose}>Fermer</Button>
        </DialogActions>
    </Dialog>
);
