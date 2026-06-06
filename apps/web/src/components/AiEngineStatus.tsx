import { useEffect, useState } from 'react';
import { Bot, CloudOff, DatabaseZap } from 'lucide-react';
import { Box, ButtonBase, Tooltip, Typography } from '@mui/material';
import { aiEngine, type AiEngineStatus as AiEngineStatusResponse } from '../api';

type StatusState = 'checking' | 'api' | 'mock' | 'down';

const statusConfig = {
    checking: {
        label: 'IA...',
        tooltip: 'Verification du moteur IA en cours.',
        color: '#64748b',
        background: 'rgba(100, 116, 139, 0.12)',
        icon: Bot,
    },
    api: {
        label: 'IA API',
        tooltip: 'Moteur IA connecte aux donnees reelles de votre organisation.',
        color: '#16a34a',
        background: 'rgba(22, 163, 74, 0.12)',
        icon: DatabaseZap,
    },
    mock: {
        label: 'IA mock',
        tooltip: 'Moteur IA actif, mais en mode demo/offline. Les donnees affichees peuvent etre mockees.',
        color: '#d97706',
        background: 'rgba(217, 119, 6, 0.14)',
        icon: Bot,
    },
    down: {
        label: 'IA off',
        tooltip: "Moteur IA indisponible pour le moment.",
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
    const [state, setState] = useState<StatusState>('checking');
    const [status, setStatus] = useState<AiEngineStatusResponse | null>(null);

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
    };

    useEffect(() => {
        refresh();
        const timer = window.setInterval(refresh, 60_000);
        return () => window.clearInterval(timer);
    }, []);

    const config = statusConfig[state];
    const Icon = config.icon;
    const tooltip = status
        ? [
            config.tooltip,
            `Source: ${status.data_source}.`,
            status.api_base_url ? `API: ${status.api_base_url}.` : null,
            status.fallback_reason ? `Raison: ${status.fallback_reason}.` : null,
            `LLM: ${status.llm.provider}${status.llm.available ? ' actif' : ' inactif'}.`,
        ].filter(Boolean).join(' ')
        : config.tooltip;

    return (
        <Tooltip title={tooltip}>
            <ButtonBase
                onClick={refresh}
                sx={{
                    mr: 1,
                    borderRadius: '999px',
                    px: { xs: 0.75, md: 1.25 },
                    py: 0.75,
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
                    sx={{ display: { xs: 'none', md: 'block' }, lineHeight: 1 }}
                >
                    {config.label}
                </Typography>
            </ButtonBase>
        </Tooltip>
    );
}
