import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BASE_URL } from '../api';
import {
    Box, Typography, Paper, FormControl, RadioGroup, FormControlLabel, Radio, Autocomplete, TextField, Checkbox, Button, MenuItem, Select, InputLabel
} from '@mui/material';
import { Bell, Send, Monitor, Smartphone, Mail } from 'lucide-react';

interface AdminUser {
    id: number;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
}

interface AdminNotificationsTabProps {
    users: AdminUser[];
    setSnackbar: (s: { open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning' }) => void;
}

export default function AdminNotificationsTab({ users, setSnackbar }: AdminNotificationsTabProps) {
    const { token } = useAuth();

    const [broadcastData, setBroadcastData] = useState({ title: '', message: '' });
    const [sendingBroadcast, setSendingBroadcast] = useState(false);
    const [notificationTarget, setNotificationTarget] = useState<'global' | 'users' | 'plan'>('global');
    const [notificationUserIds, setNotificationUserIds] = useState<number[]>([]);
    const [notificationPlan, setNotificationPlan] = useState<string>('beta');
    const [channels, setChannels] = useState<('internal' | 'push' | 'email')[]>(['internal', 'push']);

    const toggleChannel = (channel: 'internal' | 'push' | 'email') => {
        setChannels(prev =>
            prev.includes(channel) ? prev.filter(c => c !== channel) : [...prev, channel]
        );
    };

    const handleSendBroadcast = async () => {
        if (!broadcastData.title.trim() || !broadcastData.message.trim()) {
            setSnackbar({ open: true, message: 'Veuillez remplir le titre et le message', severity: 'error' });
            return;
        }
        if (notificationTarget === 'users' && notificationUserIds.length === 0) {
            setSnackbar({ open: true, message: 'Veuillez sélectionner au moins un utilisateur', severity: 'error' });
            return;
        }

        setSendingBroadcast(true);
        try {
            const payload = {
                title: broadcastData.title,
                message: broadcastData.message,
                userIds: notificationTarget === 'users' ? notificationUserIds : undefined,
                targetPlan: notificationTarget === 'plan' ? notificationPlan : undefined,
                channels,
            };

            const response = await fetch(`${BASE_URL}/notifications/broadcast`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload),
            });
            if (response.ok) {
                const res = await response.json();
                const channelNames = channels.map(c => {
                    if (c === 'internal') return 'interne';
                    if (c === 'push') return 'push';
                    return 'email';
                }).join(' + ');
                setSnackbar({ open: true, message: `Notification envoyée via ${channelNames} (${res.count} utilisateurs)`, severity: 'success' });
                setBroadcastData({ title: '', message: '' });
                setNotificationUserIds([]);
            } else {
                setSnackbar({ open: true, message: 'Erreur lors de l\'envoi de la notification', severity: 'error' });
            }
        } catch (e) {
            setSnackbar({ open: true, message: 'Erreur réseau', severity: 'error' });
        } finally {
            setSendingBroadcast(false);
        }
    };

    return (
        <Box component={Paper} elevation={1} sx={{ p: 4, borderRadius: 2, maxWidth: 600, mx: 'auto' }}>
            <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Bell size={24} color="#4f46e5" />
                Notifications Push
            </Typography>
            <Typography color="textSecondary" sx={{ mb: 4 }}>
                Envoyer une notification Push directement aux périphériques mobiles des utilisateurs.
            </Typography>

            <FormControl component="fieldset" sx={{ mb: 3 }}>
                <RadioGroup
                    row
                    value={notificationTarget}
                    onChange={(e) => {
                        setNotificationTarget(e.target.value as 'global' | 'users' | 'plan');
                        setNotificationUserIds([]);
                    }}
                >
                    <FormControlLabel value="global" control={<Radio color="primary" />} label="Tous les utilisateurs" />
                    <FormControlLabel value="plan" control={<Radio color="primary" />} label="Par plan d'organisation" />
                    <FormControlLabel value="users" control={<Radio color="primary" />} label="Utilisateurs ciblés" />
                </RadioGroup>
            </FormControl>

            {notificationTarget === 'users' && (
                <Autocomplete
                    multiple
                    options={users}
                    getOptionLabel={(option) => `${option.username} (${option.firstName} ${option.lastName})`}
                    value={users.filter(u => notificationUserIds.includes(u.id))}
                    onChange={(_, newValue) => {
                        setNotificationUserIds(newValue.map(u => u.id));
                    }}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            variant="outlined"
                            label="Sélectionner les utilisateurs"
                            placeholder="Rechercher..."
                            sx={{ mb: 3 }}
                        />
                    )}
                    renderOption={(props, option, { selected }) => (
                        <li {...props}>
                            <Checkbox style={{ marginRight: 8 }} checked={selected} />
                            {option.username} ({option.email})
                        </li>
                    )}
                />
            )}

            {notificationTarget === 'plan' && (
                <FormControl fullWidth sx={{ mb: 3 }}>
                    <InputLabel id="plan-select-label">Plan ciblé</InputLabel>
                    <Select
                        labelId="plan-select-label"
                        value={notificationPlan}
                        label="Plan ciblé"
                        onChange={(e) => setNotificationPlan(e.target.value)}
                    >
                        <MenuItem value="free">Free</MenuItem>
                        <MenuItem value="pro">Pro</MenuItem>
                        <MenuItem value="beta">Beta Tester</MenuItem>
                    </Select>
                </FormControl>
            )}

            <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 1, mb: 1 }}>
                Canal d'envoi
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={channels.includes('internal')}
                            onChange={() => toggleChannel('internal')}
                            color="primary"
                        />
                    }
                    label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Monitor size={16} /> Notification interne
                        </Box>
                    }
                />
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={channels.includes('push')}
                            onChange={() => toggleChannel('push')}
                            color="primary"
                        />
                    }
                    label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Smartphone size={16} /> Push mobile
                        </Box>
                    }
                />
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={channels.includes('email')}
                            onChange={() => toggleChannel('email')}
                            color="primary"
                        />
                    }
                    label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Mail size={16} /> Email (SMTP)
                        </Box>
                    }
                />
            </Box>

            <TextField
                margin="dense"
                label="Titre de la notification"
                fullWidth
                value={broadcastData.title}
                onChange={(e) => setBroadcastData(prev => ({ ...prev, title: e.target.value }))}
                sx={{ mb: 3 }}
            />
            <TextField
                margin="dense"
                label="Message"
                fullWidth
                multiline
                rows={4}
                value={broadcastData.message}
                onChange={(e) => setBroadcastData(prev => ({ ...prev, message: e.target.value }))}
                sx={{ mb: 4 }}
            />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                    onClick={handleSendBroadcast}
                    color="primary"
                    variant="contained"
                    size="large"
                    disabled={sendingBroadcast || !broadcastData.title.trim() || !broadcastData.message.trim() || channels.length === 0}
                    startIcon={<Send size={20} />}
                >
                    {sendingBroadcast ? 'Envoi...' : 'Envoyer la notification'}
                </Button>
            </Box>
        </Box>
    );
}
