import { useEffect, useState } from 'react';
import { Bot, CloudOff, Crown, DatabaseZap } from 'lucide-react';
import { Box, ButtonBase, Tooltip, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { aiEngine, aiStatus, type AiEngineStatus as AiEngineStatusResponse, type AiTierStatus } from '../api';

type StatusState = 'checking' | 'api' | 'mock' | 'down';

const statusConfig = {
    checking: {
        labelKey: 'aiEngineStatus.status.checking',
        labelFallback: 'AI...',
        tooltipKey: 'aiEngineStatus.tooltip.checking',
        tooltipFallback: 'Checking the AI engine.',
        color: '#64748b',
        background: 'rgba(100, 116, 139, 0.12)',
        icon: Bot,
    },
    api: {
        labelKey: 'aiEngineStatus.status.api',
        labelFallback: 'AI API',
        tooltipKey: 'aiEngineStatus.tooltip.api',
        tooltipFallback: 'AI engine connected to real organization data.',
        color: '#16a34a',
        background: 'rgba(22, 163, 74, 0.12)',
        icon: DatabaseZap,
    },
    mock: {
        labelKey: 'aiEngineStatus.status.mock',
        labelFallback: 'AI mock',
        tooltipKey: 'aiEngineStatus.tooltip.mock',
        tooltipFallback: 'AI engine active in demo/offline mode. Displayed data may be mocked.',
        color: '#d97706',
        background: 'rgba(217, 119, 6, 0.14)',
        icon: Bot,
    },
    down: {
        labelKey: 'aiEngineStatus.status.down',
        labelFallback: 'AI off',
        tooltipKey: 'aiEngineStatus.tooltip.down',
        tooltipFallback: 'AI engine is currently unavailable.',
        color: '#dc2626',
        background: 'rgba(220, 38, 38, 0.12)',
        icon: CloudOff,
    },
};

const resolveState = (status: AiEngineStatusResponse | null): StatusState => {
    if (!status) return 'down';
    if (status.api_connected || status.data_source === 'main_api') return 'api';
    return 'mock';
};

export default function AiEngineStatus() {
    const { t } = useTranslation();
    const [state, setState] = useState<StatusState>('checking');
    const [status, setStatus] = useState<AiEngineStatusResponse | null>(null);
    const [tier, setTier] = useState<AiTierStatus | null>(null);

    const refresh = async () => {
        setState((current) => (current === 'down' ? 'checking' : current));
        try {
            const response = await aiEngine.status();
            setStatus(response);
            setState(resolveState(response));
        } catch {
            setStatus(null);
            setState('down');
        }
        try {
            setTier(await aiStatus());
        } catch {
            setTier(null);
        }
    };

    useEffect(() => {
        refresh();
        const timer = window.setInterval(refresh, 60_000);
        return () => window.clearInterval(timer);
    }, []);

    const config = statusConfig[state];
    const Icon = config.icon;
    const isPro = tier?.tier === 'pro';
    const statusLabel = t(config.labelKey, config.labelFallback);
    const tierLabel = tier
        ? (isPro ? t('aiEngineStatus.tier.pro', 'Pro') : t('aiEngineStatus.tier.free', 'Free'))
        : t('aiEngineStatus.tier.unknown', 'Plan?');
    const badgeLabel = `${statusLabel} - ${tierLabel}`;
    const tooltip = [
        t(config.tooltipKey, config.tooltipFallback),
        status ? `${t('aiEngineStatus.detail.source', 'Source')}: ${status.data_source}.` : null,
        status?.api_base_url ? `${t('aiEngineStatus.detail.api', 'API')}: ${status.api_base_url}.` : null,
        status?.fallback_reason ? `${t('aiEngineStatus.detail.reason', 'Reason')}: ${status.fallback_reason}.` : null,
        status ? `${t('aiEngineStatus.detail.llm', 'LLM')}: ${status.llm.provider} ${status.llm.available ? t('aiEngineStatus.detail.active', 'active') : t('aiEngineStatus.detail.inactive', 'inactive')}.` : null,
        tier ? `${t('aiEngineStatus.detail.tier', 'AI tier')}: ${isPro ? t('aiEngineStatus.detail.proDescription', 'Pro persistent intelligence') : t('aiEngineStatus.detail.freeDescription', 'Free basic suggestions')}.` : null,
    ].filter(Boolean).join(' ');

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
            <Tooltip title={tooltip}>
                <ButtonBase
                    onClick={refresh}
                    sx={{
                        borderRadius: '999px',
                        minHeight: 38,
                        px: { xs: 0.85, md: 1.15 },
                        py: 0.6,
                        gap: 0.75,
                        bgcolor: config.background,
                        color: config.color,
                        border: `1px solid ${config.color}33`,
                        '&:hover': { bgcolor: config.background },
                    }}
                >
                    <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Icon size={18} />
                        <Box
                            sx={{
                                position: 'absolute',
                                right: -3,
                                bottom: -3,
                                width: 7,
                                height: 7,
                                borderRadius: '50%',
                                bgcolor: config.color,
                                border: '1px solid',
                                borderColor: 'background.paper',
                            }}
                        />
                    </Box>
                    <Typography
                        variant="caption"
                        fontWeight={700}
                        noWrap
                        sx={{ display: { xs: 'none', md: 'block' }, lineHeight: 1, maxWidth: 132 }}
                    >
                        {badgeLabel}
                    </Typography>
                    {isPro && <Crown size={14} />}
                </ButtonBase>
            </Tooltip>
        </Box>
    );
}
