import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    FormControlLabel,
    Switch,
    Grid,
    Alert,
    InputAdornment,
    IconButton
} from '@mui/material';
import { Eye, EyeOff } from 'lucide-react';

interface UserModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    initialData?: any;
    organizations?: { id: number; name: string }[];
}

import { useAuth } from '../contexts/AuthContext';

export default function UserModal({ open, onClose, onSubmit, initialData, organizations = [] }: UserModalProps) {
    const { t } = useTranslation();
    const { user: currentUser } = useAuth();
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        firstName: '',
        lastName: '',
        password: '',
        systemRole: 'user',
        isActive: true,
        organizationId: '' as string | number,
        newOrganizationName: ''
    });
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (open) {
            if (initialData) {
                setFormData({
                    username: initialData.username || '',
                    email: initialData.email || '',
                    firstName: initialData.firstName || '',
                    lastName: initialData.lastName || '',
                    password: '',
                    systemRole: initialData.systemRole || (initialData.isSuperAdmin ? 'super_admin' : 'user'),
                    isActive: initialData.isActive !== undefined ? initialData.isActive : true,
                    organizationId: '',
                    newOrganizationName: ''
                });
            } else {
                setFormData({
                    username: '',
                    email: '',
                    firstName: '',
                    lastName: '',
                    password: '',
                    systemRole: 'user',
                    isActive: true,
                    organizationId: '',
                    newOrganizationName: ''
                });
            }
            setError('');
        }
    }, [open, initialData]);

    const handleSubmit = async () => {
        try {
            await onSubmit(formData);
            onClose();
        } catch (err) {
            setError('Failed to save user');
            console.error(err);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{initialData ? t('admin.editUser') : t('admin.addUser')}</DialogTitle>
            <DialogContent>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                {initialData?.googleId && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        {t('admin.googleAccountNotice', 'Cet utilisateur est lié à un compte Google. L\'e-mail et le mot de passe sont gérés par Google.')}
                    </Alert>
                )}
                <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid size={{ xs: 12 }}>
                        <TextField
                            fullWidth
                            label={t('login.username')}
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        />
                    </Grid>
                        <TextField
                            fullWidth
                            label="Email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            disabled={!!initialData}
                        />
                    <Grid size={{ xs: 6 }}>
                        <TextField
                            fullWidth
                            label={t('settings.firstName')}
                            value={formData.firstName}
                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                        <TextField
                            fullWidth
                            label={t('settings.lastName')}
                            value={formData.lastName}
                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        />
                    </Grid>
                    {!initialData?.googleId && (
                        <Grid size={{ xs: 12 }}>
                            <TextField
                                fullWidth
                                type={showPassword ? 'text' : 'password'}
                                label={initialData ? "New Password (leave blank to keep)" : "Password"}
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                helperText={initialData ? "Only enter to change password" : "Required"}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton
                                                onClick={() => setShowPassword(!showPassword)}
                                                edge="end"
                                            >
                                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                            />
                        </Grid>
                    )}
                    <Grid size={{ xs: 12 }}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    color="success"
                                />
                            }
                            label={t('admin.accountActive')}
                        />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <TextField
                            select
                            fullWidth
                            label={t('admin.systemRole') || 'System Role'}
                            value={formData.systemRole}
                            onChange={(e) => setFormData({ ...formData, systemRole: e.target.value })}
                            SelectProps={{
                                native: true,
                            }}
                        >
                            <option value="user">{t('common.user') || 'User'}</option>
                            <option value="moderator">{t('common.moderator') || 'Moderator'}</option>
                            {(currentUser?.isSuperAdmin || currentUser?.systemRole === 'super_admin') && (
                                <>
                                    <option value="admin">{t('common.admin') || 'Admin'}</option>
                                    <option value="super_admin">{t('common.super_admin') || 'Super Admin'}</option>
                                </>
                            )}
                        </TextField>
                    </Grid>
                    {/* Organization Dropdown */}
                    <Grid size={{ xs: 12 }}>
                        <TextField
                            select
                            fullWidth
                            label={t('admin.assignOrganization') || 'Assign Organization'}
                            value={formData.organizationId}
                            onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
                            SelectProps={{
                                native: true,
                            }}
                            helperText={initialData 
                                ? (t('admin.addOrganizationHelper') || 'Add user to another organization')
                                : (t('admin.assignOrganizationHelper') || 'Optional: Assign user to an organization')}
                        >
                            <option value="">{t('common.none') || 'None'}</option>
                            {organizations.map((org) => (
                                <option key={org.id} value={org.id}>
                                    {org.name}
                                </option>
                            ))}
                            {!initialData && (
                                <option value="create_new">➕ {t('admin.createNewOrganization') || 'Create New Organization'}</option>
                            )}
                        </TextField>
                    </Grid>

                    {/* New Organization Name Input */}
                    {!initialData && formData.organizationId === 'create_new' && (
                        <Grid size={{ xs: 12 }}>
                            <TextField
                                fullWidth
                                label={t('admin.newOrganizationName') || 'New Organization Name'}
                                value={formData.newOrganizationName}
                                onChange={(e) => setFormData({ ...formData, newOrganizationName: e.target.value })}
                                placeholder="My New Organization"
                            />
                        </Grid>
                    )}
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={handleSubmit}>Save</Button>
            </DialogActions>
        </Dialog >
    );
}
