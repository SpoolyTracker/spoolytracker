import { Box, Typography, Tabs, Tab } from '@mui/material';
import { Users, Building2, BarChart3, Bell, CreditCard, ScrollText, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';

export default function AdminLayout() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();

    // Map path to tab index
    const getTabIndex = () => {
        const path = location.pathname;
        if (path.includes('/admin/users')) return 0;
        if (path.includes('/admin/organizations')) return 1;
        if (path.includes('/admin/statistics')) return 2;
        if (path.includes('/admin/notifications')) return 3;
        if (path.includes('/admin/subscriptions')) return 4;
        if (path.includes('/admin/audit-log')) return 5;
        if (path.includes('/admin/settings')) return 6;
        return 0;
    };

    const handleTabChange = (_: any, newValue: number) => {
        const paths = [
            '/admin/users',
            '/admin/organizations',
            '/admin/statistics',
            '/admin/notifications',
            '/admin/subscriptions',
            '/admin/audit-log',
            '/admin/settings'
        ];
        navigate(paths[newValue]);
    };

    return (
        <Box sx={{ p: 4, maxWidth: 1400, mx: 'auto' }}>
            <Box sx={{ mb: 4 }}>
                <Typography variant="h3" fontWeight="bold" gutterBottom>
                    🔐 {t('common.admin') || 'Admin Panel'}
                </Typography>
                <Typography color="textSecondary">
                    Super Admin Dashboard - Manage all organizations and users
                </Typography>
            </Box>

            <Tabs 
                value={getTabIndex()} 
                onChange={handleTabChange} 
                sx={{ mb: 4, borderBottom: 1, borderColor: 'divider' }}
            >
                <Tab icon={<Users size={20} />} iconPosition="start" label={t('admin.users')} />
                <Tab icon={<Building2 size={20} />} iconPosition="start" label={t('admin.orgs')} />
                <Tab icon={<BarChart3 size={20} />} iconPosition="start" label={t('admin.stats')} />
                <Tab icon={<Bell size={20} />} iconPosition="start" label="Notifications" />
                <Tab icon={<CreditCard size={20} />} iconPosition="start" label="Subscriptions" />
                <Tab icon={<ScrollText size={20} />} iconPosition="start" label={t('admin.audit.title')} />
                <Tab icon={<Settings size={20} />} iconPosition="start" label={t('admin.configuration')} />
            </Tabs>

            <Box sx={{ mt: 2 }}>
                <Outlet />
            </Box>
        </Box>
    );
}
