import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { CircularProgress, Box } from '@mui/material';

export default function QuotaGuard({ children }: { children: React.ReactNode }) {
    const [loading, setLoading] = useState(true);
    const [requiresSelection, setRequiresSelection] = useState(false);
    const { user } = useAuth();
    const location = useLocation();

    useEffect(() => {
        let isMounted = true;

        async function checkQuota() {
            try {
                // Bypass for admins, super admins, and moderators
                const isBypass = user?.isSuperAdmin || ['super_admin', 'admin', 'moderator'].includes(user?.systemRole || '');
                if (isBypass) {
                    if (isMounted) {
                        setRequiresSelection(false);
                        setLoading(false);
                    }
                    return;
                }

                const orgId = localStorage.getItem('organization_id');
                if (!orgId) {
                    if (isMounted) setLoading(false);
                    return;
                }

                // We could optimize this by caching the flag if needed, 
                // but for now a direct check ensures security on navigation
                const orgData = await api.getOrgData(orgId);
                if (isMounted) {
                    setRequiresSelection(!!orgData.requiresQuotaSelection);
                    setLoading(false);
                }
            } catch (err) {
                console.error('Failed to check quota status:', err);
                if (isMounted) setLoading(false);
            }
        }

        checkQuota();

        return () => {
            isMounted = false;
        };
    }, [location.pathname]); // Re-check on navigation (can be optimized if too heavy)

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
                <CircularProgress />
            </Box>
        );
    }

    if (requiresSelection && location.pathname !== '/resolve-quota') {
        return <Navigate to="/resolve-quota" replace />;
    }

    return <>{children}</>;
}
