import React, { useEffect, useRef, useState } from 'react';
import { Bot, Brain, CheckCircle2, ExternalLink, Info, MessageSquare, Send, ShoppingCart, Sparkles, Trash2, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    Fab,
    IconButton,
    MenuItem,
    Paper,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { aiActions, aiEngine, askAgent, type AiEngineCapabilities, type AiMemoryRecord } from '../api';
import { useAuth } from '../contexts/AuthContext';

interface GatewayAction {
    id: string;
    type: string;
    label: string;
    payload: Record<string, any>;
    status: string;
    result?: any;
    failureReason?: string;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'agent';
    content: string;
    intent?: string;
    isError?: boolean;
    data?: {
        actions?: GatewayAction[];
        [key: string]: any;
    };
}

const INIT_MESSAGE: ChatMessage = {
    id: 'init-1',
    role: 'agent',
    content:
        "Bonjour, je suis l'assistant Spooly.\n\nPosez une question sur votre stock, un projet, une consommation ou une prevision Pro. Je propose les actions sensibles sans les executer directement.",
};

const QUICK_PROMPTS = [
    'Combien il me reste de PLA noir ?',
    'Ajoute une consommation de 250g de PETG blanc pour le projet Support mural',
    'Quels stocks sont a risque ?',
    'Souviens-toi que je veux garder 2kg minimum de PLA noir',
];

const sanitizeAiDisplayContent = (content: string) => (
    content
        .replace(/\s*#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/gi, '')
        .replace(/\s*couleur personnalis(?:e|ee|ée|Ã©e)/gi, '')
        .replace(/[ \t]{2,}/g, ' ')
);

export const AiChatWidget: React.FC = () => {
    const { token } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [capabilities, setCapabilities] = useState<AiEngineCapabilities | null>(null);
    const [memoryRefreshKey, setMemoryRefreshKey] = useState(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!token) return;
        aiEngine.capabilities().then(setCapabilities).catch(() => setCapabilities(null));
    }, [token]);

    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([INIT_MESSAGE]);
        }
    }, [isOpen, messages.length]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    if (!token) return null;

    const handleSend = async (text: string = inputValue) => {
        if (!text.trim() || isLoading) return;
        const effectiveText = normalizeFollowUp(text, messages);

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: text,
        };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsLoading(true);

        try {
            const res = await askAgent(effectiveText);
            const agentMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'agent',
                content: res.answer || "Desole, je n'ai pas de reponse.",
                intent: res.intent,
                data: res.data,
            };
            setMessages(prev => [...prev, agentMsg]);
            if (res.intent === 'memory_saved') {
                setMemoryRefreshKey(prev => prev + 1);
            }
        } catch (_error) {
            setMessages(prev => [
                ...prev,
                {
                    id: (Date.now() + 1).toString(),
                    role: 'agent',
                    content:
                        "Une erreur est survenue avec le moteur IA. Verifiez que `ai-engine` est lance.",
                    isError: true,
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const llmLabel = capabilities?.llm?.provider && capabilities.llm.provider !== 'none'
        ? `LLM ${capabilities.llm.provider}${capabilities.llm.available ? '' : ' indisponible'}`
        : 'Moteur deterministe';

    const gatewayActionStatusLabel = (s: string) =>
        s === 'executed' ? 'Execute' : s === 'rejected' ? 'Rejete' : s === 'failed' ? 'Echec' : s;

    const updateGatewayActionInState = (actionId: string, patch: Partial<Pick<GatewayAction, 'status' | 'result' | 'failureReason'>>) => {
        setMessages(prev => prev.map(m => ({
            ...m,
            data: m.data?.actions
                ? { ...m.data, actions: m.data.actions.map((a: GatewayAction) => a.id === actionId ? { ...a, ...patch } : a) }
                : m.data,
        })));
    };

    const handleGatewayApprove = async (id: string) => {
        updateGatewayActionInState(id, { status: 'loading' });
        try {
            const updated = await aiActions.approve(id);
            updateGatewayActionInState(id, { status: updated.status, result: updated.result, failureReason: updated.failureReason });
        } catch {
            updateGatewayActionInState(id, { status: 'failed' });
        }
    };

    const handleGatewayReject = async (id: string) => {
        updateGatewayActionInState(id, { status: 'loading' });
        try {
            const updated = await aiActions.reject(id);
            updateGatewayActionInState(id, { status: updated.status });
        } catch {
            updateGatewayActionInState(id, { status: 'rejected' });
        }
    };

    return (
        <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            {isOpen && (
                <Paper
                    elevation={12}
                    sx={{
                        mb: 2,
                        width: { xs: 'calc(100vw - 32px)', sm: 760 },
                        height: { xs: 'min(680px, calc(100vh - 112px))', sm: 600 },
                        maxHeight: '80vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        borderRadius: 3,
                        border: '1px solid',
                        borderColor: 'divider',
                    }}
                >
                    <Box
                        sx={{
                            color: 'text.primary',
                            p: 2,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            background: 'linear-gradient(135deg, rgba(22, 97, 175, 0.12), rgba(22, 163, 74, 0.08))',
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: 'primary.main', color: 'primary.contrastText', display: 'grid', placeItems: 'center' }}>
                                <Bot size={20} />
                            </Box>
                            <Box>
                                <Typography variant="h6" sx={{ fontSize: '1.05rem', fontWeight: 'bold', lineHeight: 1.15 }}>
                                    Assistant Spooly
                                </Typography>
                                <Stack direction="row" spacing={0.75} alignItems="center">
                                    <Chip label={llmLabel} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.68rem' }} />
                                </Stack>
                            </Box>
                        </Box>
                        <IconButton size="small" onClick={() => setIsOpen(false)}>
                            <X size={20} />
                        </IconButton>
                    </Box>

                    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', bgcolor: 'rgba(15, 23, 42, 0.03)' }}>
                        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                            <Box sx={{ flex: 1, p: 2, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                {messages.map(msg => (
                                    <Box key={msg.id} sx={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                        <Box
                                            sx={{
                                                maxWidth: '88%',
                                                p: 1.5,
                                                borderRadius: 2.5,
                                                borderTopLeftRadius: msg.role === 'agent' ? 0.75 : 2.5,
                                                borderTopRightRadius: msg.role === 'user' ? 0.75 : 2.5,
                                                bgcolor: msg.role === 'user' ? 'primary.main' : (msg.isError ? 'error.light' : 'background.paper'),
                                                color: msg.role === 'user' ? 'primary.contrastText' : (msg.isError ? 'error.contrastText' : 'text.primary'),
                                                border: msg.role === 'agent' ? '1px solid' : 'none',
                                                borderColor: 'divider',
                                                boxShadow: msg.role === 'agent' ? '0 8px 22px rgba(15, 23, 42, 0.06)' : '0 8px 18px rgba(22, 97, 175, 0.22)',
                                            }}
                                        >
                                            {msg.role === 'agent' && (msg.intent === 'restricted' || msg.intent === 'pro_feature') ? (
                                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'warning.main', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                                        <Info size={16} /> Fonctionnalite Pro
                                                    </Box>
                                                    <Box sx={{ '& p': { m: 0, mt: 0.5 }, fontSize: '0.9rem' }}>
                                                        <ReactMarkdown>{sanitizeAiDisplayContent(msg.content)}</ReactMarkdown>
                                                    </Box>
                                                </Box>
                                            ) : (
                                                <Box
                                                    sx={{
                                                        '& p': { m: 0, mb: 1, '&:last-child': { mb: 0 } },
                                                        '& ul': { m: 0, pl: 2 },
                                                        '& li': { mb: 0.5, pl: 0.25 },
                                                        '& strong': { fontWeight: 800 },
                                                        fontSize: '0.9rem',
                                                    }}
                                                >
                                                    <ReactMarkdown>{sanitizeAiDisplayContent(msg.content)}</ReactMarkdown>
                                                    {msg.data?.persistentIntelligence === false && (
                                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                                            Passez en Pro pour que l'assistant retienne vos préférences et vos choix de bobines.
                                                        </Typography>
                                                    )}
                                                    {Array.isArray(msg.data?.recommendations) && msg.data.recommendations.length > 0 && (
                                                        <Stack spacing={1} sx={{ mt: 1 }}>
                                                            {msg.data.recommendations.map((rec: any, idx: number) => (
                                                                <Box
                                                                    key={rec.item_id || idx}
                                                                    sx={{
                                                                        p: 1,
                                                                        borderRadius: 2,
                                                                        border: '1px solid',
                                                                        borderColor: rec.urgency === 'immediate' ? 'error.light' : 'divider',
                                                                        bgcolor: rec.urgency === 'immediate' ? 'rgba(239, 68, 68, 0.06)' : 'rgba(15, 23, 42, 0.02)',
                                                                    }}
                                                                >
                                                                    <Stack spacing={0.75}>
                                                                        <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="space-between">
                                                                            <Typography variant="caption" fontWeight={800}>{rec.item_name}</Typography>
                                                                            <Chip
                                                                                label={rec.urgency === 'immediate' ? 'Urgent' : 'À prévoir'}
                                                                                color={rec.urgency === 'immediate' ? 'error' : 'default'}
                                                                                size="small"
                                                                                sx={{ height: 20, fontSize: '0.66rem' }}
                                                                            />
                                                                        </Stack>
                                                                        {rec.reason && (
                                                                            <Typography variant="caption" color="text.secondary">{rec.reason}</Typography>
                                                                        )}
                                                                        {(() => {
                                                                            const providers: Array<{ provider_name?: string; url?: string }> =
                                                                                Array.isArray(rec.providers) && rec.providers.length > 0
                                                                                    ? rec.providers
                                                                                    : rec.provider_url
                                                                                        ? [{ provider_name: rec.provider_name, url: rec.provider_url }]
                                                                                        : [];
                                                                            if (providers.length === 0) return null;
                                                                            return (
                                                                                <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                                                                                    {providers.map((provider, providerIdx) => provider.url && (
                                                                                        <Button
                                                                                            key={provider.url || providerIdx}
                                                                                            size="small"
                                                                                            variant={providerIdx === 0 ? 'contained' : 'outlined'}
                                                                                            color="primary"
                                                                                            startIcon={<ShoppingCart size={14} />}
                                                                                            endIcon={<ExternalLink size={12} />}
                                                                                            href={provider.url}
                                                                                            target="_blank"
                                                                                            rel="noopener noreferrer"
                                                                                            sx={{ textTransform: 'none' }}
                                                                                        >
                                                                                            {provider.provider_name || 'Commander'}
                                                                                        </Button>
                                                                                    ))}
                                                                                </Stack>
                                                                            );
                                                                        })()}
                                                                    </Stack>
                                                                </Box>
                                                            ))}
                                                        </Stack>
                                                    )}
                                                    {msg.data?.actions && msg.data.actions.length > 0 && (
                                                        <Stack spacing={1} sx={{ mt: 1 }}>
                                                            {msg.data.actions.map((action: GatewayAction) => (
                                                                <Box
                                                                    key={action.id}
                                                                    sx={{
                                                                        p: 1,
                                                                        borderRadius: 2,
                                                                        border: '1px solid',
                                                                        borderColor: action.status === 'failed' ? 'error.light' : 'warning.light',
                                                                        bgcolor: 'rgba(245, 158, 11, 0.06)',
                                                                    }}
                                                                >
                                                                    <Stack spacing={1}>
                                                                        <Stack direction="row" spacing={0.75} alignItems="center">
                                                                            <CheckCircle2 size={15} />
                                                                            <Typography variant="caption" fontWeight={800}>
                                                                                {action.label || `Action: ${action.type}`}
                                                                            </Typography>
                                                                        </Stack>
                                                                        {action.status === 'proposed' ? (
                                                                            <Stack direction="row" spacing={1}>
                                                                                <Button
                                                                                    size="small"
                                                                                    variant="contained"
                                                                                    color="warning"
                                                                                    onClick={() => handleGatewayApprove(action.id)}
                                                                                >
                                                                                    Valider
                                                                                </Button>
                                                                                <Button
                                                                                    size="small"
                                                                                    variant="text"
                                                                                    color="inherit"
                                                                                    onClick={() => handleGatewayReject(action.id)}
                                                                                >
                                                                                    Rejeter
                                                                                </Button>
                                                                            </Stack>
                                                                        ) : action.status === 'loading' ? (
                                                                            <Stack direction="row" spacing={1} alignItems="center">
                                                                                <CircularProgress size={14} color="inherit" />
                                                                                <Typography variant="caption">En cours...</Typography>
                                                                            </Stack>
                                                                        ) : (
                                                                            <Stack spacing={0.5}>
                                                                                <Chip
                                                                                    label={gatewayActionStatusLabel(action.status)}
                                                                                    color={action.status === 'executed' ? 'success' : action.status === 'failed' ? 'error' : 'default'}
                                                                                    size="small"
                                                                                />
                                                                                {action.result?.remaining_after_g !== undefined && (
                                                                                    <Typography variant="caption" color="text.secondary">
                                                                                        Stock restant: {action.result.remaining_after_g}g
                                                                                    </Typography>
                                                                                )}
                                                                                {action.failureReason && (
                                                                                    <Typography variant="caption" color="error">
                                                                                        {action.failureReason}
                                                                                    </Typography>
                                                                                )}
                                                                            </Stack>
                                                                        )}
                                                                    </Stack>
                                                                </Box>
                                                            ))}
                                                        </Stack>
                                                    )}
                                                </Box>
                                            )}
                                        </Box>
                                    </Box>
                                ))}
                                {isLoading && (
                                    <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                                        <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, borderTopLeftRadius: 0, display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                                            <CircularProgress size={16} color="inherit" />
                                            <Typography variant="body2">Reflexion...</Typography>
                                        </Paper>
                                    </Box>
                                )}
                                <div ref={messagesEndRef} />
                            </Box>

                            <Box sx={{ p: 1.5, bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}>
                                {messages.length <= 5 && !isLoading && (
                                    <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 1 }}>
                                        {QUICK_PROMPTS.map(prompt => (
                                            <Chip
                                                key={prompt}
                                                label={prompt}
                                                onClick={() => handleSend(prompt)}
                                                variant="outlined"
                                                size="small"
                                                clickable
                                                sx={{ borderRadius: '16px', minWidth: 'max-content' }}
                                            />
                                        ))}
                                    </Stack>
                                )}
                                <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <TextField
                                        fullWidth
                                        variant="outlined"
                                        size="small"
                                        placeholder="Posez votre question..."
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        disabled={isLoading}
                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: 'background.paper' } }}
                                    />
                                    <IconButton
                                        type="submit"
                                        color="primary"
                                        disabled={!inputValue.trim() || isLoading}
                                        sx={{ width: 42, height: 42, bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' }, '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' } }}
                                    >
                                        <Send size={18} />
                                    </IconButton>
                                </form>
                            </Box>
                        </Box>

                        <MemoryPanel refreshKey={memoryRefreshKey} />
                    </Box>
                </Paper>
            )}

            {!isOpen && (
                <Fab color="primary" aria-label="chat" data-tour="tour-ai-agent" onClick={() => setIsOpen(true)} sx={{ width: 64, height: 64 }}>
                    <MessageSquare size={28} />
                    <Sparkles size={14} style={{ position: 'absolute', top: 12, right: 12, color: 'white', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
                </Fab>
            )}
        </Box>
    );
};

const memoryTypeLabels: Record<AiMemoryRecord['type'], string> = {
    preference: 'Preference',
    correction: 'Correction',
    learned_rule: 'Regle',
    feedback: 'Feedback',
};

const MemoryPanel: React.FC<{ refreshKey: number }> = ({ refreshKey }) => {
    const [memories, setMemories] = useState<AiMemoryRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [content, setContent] = useState('');
    const [type, setType] = useState<AiMemoryRecord['type']>('preference');

    const loadMemories = async () => {
        setLoading(true);
        try {
            const response = await aiEngine.memories();
            setMemories(response.items || []);
        } catch {
            setMemories([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMemories();
    }, [refreshKey]);

    const handleCreate = async () => {
        if (!content.trim()) return;
        await aiEngine.createMemory(content.trim(), type);
        setContent('');
        await loadMemories();
    };

    const handleDelete = async (id: string) => {
        await aiEngine.deleteMemory(id);
        setMemories(prev => prev.filter(memory => memory.id !== id));
    };

    return (
        <Box
            sx={{
                width: 280,
                display: { xs: 'none', sm: 'flex' },
                flexDirection: 'column',
                borderLeft: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
            }}
        >
            <Box sx={{ p: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Brain size={18} />
                    <Box>
                        <Typography variant="subtitle2" fontWeight={800}>Memoire IA</Typography>
                        <Typography variant="caption" color="text.secondary">Preferences, corrections et retours.</Typography>
                    </Box>
                </Stack>
            </Box>
            <Divider />
            <Box sx={{ p: 1.5 }}>
                <Stack spacing={1}>
                    <TextField
                        select
                        size="small"
                        label="Type"
                        value={type}
                        onChange={(event) => setType(event.target.value as AiMemoryRecord['type'])}
                    >
                        {Object.entries(memoryTypeLabels).map(([value, label]) => (
                            <MenuItem key={value} value={value}>{label}</MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        size="small"
                        multiline
                        minRows={2}
                        placeholder="Ex: garder 2kg de PLA noir"
                        value={content}
                        onChange={(event) => setContent(event.target.value)}
                    />
                    <Button variant="contained" size="small" onClick={handleCreate} disabled={!content.trim()}>
                        Ajouter
                    </Button>
                </Stack>
            </Box>
            <Divider />
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 1.25 }}>
                {loading ? (
                    <Stack direction="row" spacing={1} alignItems="center" color="text.secondary">
                        <CircularProgress size={14} />
                        <Typography variant="caption">Chargement...</Typography>
                    </Stack>
                ) : memories.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        Aucune memoire pour le moment.
                    </Typography>
                ) : (
                    <Stack spacing={1}>
                        {memories.map(memory => (
                            <Box
                                key={memory.id}
                                sx={{
                                    p: 1,
                                    borderRadius: 2,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    bgcolor: 'rgba(15, 23, 42, 0.02)',
                                }}
                            >
                                <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="space-between">
                                    <Chip label={memoryTypeLabels[memory.type]} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.68rem' }} />
                                    <IconButton size="small" onClick={() => handleDelete(memory.id)}>
                                        <Trash2 size={14} />
                                    </IconButton>
                                </Stack>
                                <Typography variant="body2" sx={{ mt: 0.75, fontSize: '0.82rem' }}>
                                    {memory.content}
                                </Typography>
                            </Box>
                        ))}
                    </Stack>
                )}
            </Box>
        </Box>
    );
};

const normalizeFollowUp = (text: string, messages: ChatMessage[]): string => {
    const normalized = text.toLowerCase();
    const lastAgent = [...messages].reverse().find(message => message.role === 'agent');
    const asksForDetails = normalized.includes('indique') || normalized.includes('detail') || normalized.includes('détail');
    if (asksForDetails && lastAgent?.intent === 'pro_risks') {
        return 'Quels stocks sont à risque ? Donne le détail des matériaux et projets à risque.';
    }
    return text;
};
