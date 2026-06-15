import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Container, Box, Typography, Card, CardContent, Button,
    Checkbox, List, ListItem, ListItemIcon, ListItemText,
    CircularProgress, Alert
} from '@mui/material';
import { AlertTriangle, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import type { Filament } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { getFilamentTitle } from '../utils/filament-utils';
import ColorIndicator from '../components/ColorIndicator';

export default function ResolveQuotaPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [filaments, setFilaments] = useState<Filament[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [maxAllowed, setMaxAllowed] = useState(30); // Default, updated on load

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const orgId = localStorage.getItem('organization_id');
            if (!orgId) {
                navigate('/login');
                return;
            }

            const [orgData, filamentsData] = await Promise.all([
                api.getOrgData(orgId),
                api.getAll()
            ]);

            // If it doesn't require selection anymore, go to dashboard
            if (!orgData.requiresQuotaSelection) {
                navigate('/dashboard');
                return;
            }

            // In PLAN_LIMITS, Free plan has 30 max spools.
            const limit = orgData.stats?.limits?.maxSpoolsPerOrg;
            setMaxAllowed(limit === null || limit === undefined ? 999999 : limit);
            setFilaments(filamentsData || []);
        } catch (err) {
            console.error(err);
            setError('Failed to load data. Please refresh.');
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (id: number) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            const isBypass = user?.isSuperAdmin || ['super_admin', 'admin', 'moderator'].includes(user?.systemRole || '');
            if (!isBypass && newSelected.size >= maxAllowed) {
                setError(t('resolveQuota.errorMax', { maxAllowed }));
                return;
            }
            newSelected.add(id);
            setError(''); // Clear error if successful
        }
        setSelectedIds(newSelected);
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setError('');
        try {
            const orgId = localStorage.getItem('organization_id');
            if (!orgId) throw new Error('No organization ID');

            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/organizations/${orgId}/resolve-quota`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({ selectedFilamentIds: Array.from(selectedIds) })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || t('resolveQuota.errorDefault'));
            }

            // Redirect back to dashboard and clear the lock
            navigate('/dashboard');
            window.location.reload(); // Hard reload to refresh all states globally
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('resolveQuota.errorDefault'));
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Container maxWidth="md" sx={{ py: 8 }}>
            <Card elevation={4} sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <Box display="flex" alignItems="center" gap={2} mb={2}>
                        <AlertTriangle size={40} color="#ef4444" />
                        <Typography variant="h4" fontWeight="bold">{t('resolveQuota.title')}</Typography>
                    </Box>

                    <Alert severity="warning" icon={<Lock />} sx={{ mb: 2 }}>
                        {t('resolveQuota.message', { maxAllowed })}
                    </Alert>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="h6">{t('resolveQuota.selectActive')}</Typography>
                        <Typography variant="subtitle1" fontWeight="bold" color={selectedIds.size === maxAllowed ? 'success.main' : 'textSecondary'}>
                            {t('resolveQuota.selected', { count: selectedIds.size, maxAllowed: (maxAllowed === 999999 || maxAllowed === Infinity) ? '∞' : maxAllowed })}
                        </Typography>
                    </Box>

                    {error && <Alert severity="error">{error}</Alert>}

                    <Card variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
                        <List disablePadding>
                            {filaments.map(filament => {
                                const title = getFilamentTitle(filament);
                                const isChecked = selectedIds.has(filament.id);
                                return (
                                    <ListItem
                                        key={filament.id}
                                        divider
                                        secondaryAction={
                                            <Checkbox
                                                edge="end"
                                                checked={isChecked}
                                                onChange={() => handleToggle(filament.id)}
                                            />
                                        }
                                        sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                                        onClick={() => handleToggle(filament.id)}
                                    >
                                        <ListItemIcon>
                                            <ColorIndicator colors={filament.colors || []} primaryColor={filament.color || ''} size={24} />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={title}
                                            secondary={`${filament.weightRemaining.toFixed(0)}g ${t('resolveQuota.remaining')}`}
                                        />
                                    </ListItem>
                                );
                            })}
                        </List>
                    </Card>

                    <Box display="flex" justifyContent="flex-end" mt={2}>
                        <Button
                            variant="contained"
                            color="primary"
                            size="large"
                            disabled={submitting || filaments.length === 0}
                            onClick={handleSubmit}
                        >
                            {submitting ? <CircularProgress size={24} color="inherit" /> : t('resolveQuota.confirm')}
                        </Button>
                    </Box>
                </CardContent>
            </Card>
        </Container>
    );
}
