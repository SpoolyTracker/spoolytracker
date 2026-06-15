import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTour } from '../contexts/TourContext';
import { useTranslation } from 'react-i18next';
import { OrganizationSwitcher } from '../components/OrganizationSwitcher';
import { PendingInvitations } from '../components/PendingInvitations';
import { SubscriptionHistory } from '../components/SubscriptionHistory';
import { Box } from '@mui/material';
import { Building, User, Users, Eye, EyeOff, Download, Printer as PrinterIcon, Nfc, Trash2, Bell, Settings as SettingsIcon, KeyRound, Copy, FileCode2 } from 'lucide-react';
import { api, BASE_URL, type ApiKeySummary } from '../api';
import { SecureImage } from '../components/SecureImage';
import PageHeader from '../components/PageHeader';



interface Member {
    id: number;
    username: string;
    role: 'owner' | 'admin' | 'member';
}

const GoogleIcon = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
);

const AppleIcon = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 384 512" fill="currentColor" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 21.8-88.5 21.8-14.7 0-51.4-22.2-84.6-20.6-53 1.1-102.3 31.2-126.3 76.8-42.2 79.9-10.9 199 29.1 259.8 19.5 29.7 44.1 57.9 76.2 56.7 31.3-1.1 43.1-20.5 81.2-20.5 37.5 0 49.3 20.5 81.8 19.9 33.1-.6 54.4-25.3 74.4-54.1 23.2-34.1 32.8-67.1 33.1-68.8-.7-.3-63.5-24.8-63.8-91.5zM232.1 105.9c33.3-40.6 30.2-76.1 27.8-92.7-27.1 1.4-62.7 19.8-83.3 43.7-18.8 21.2-35.4 57.4-30.8 90.3 30.1 2.3 62-18.7 86.3-45.3z"/>
    </svg>
);

export default function SettingsPage() {
    const { user, token, updateUser, linkSocialProvider, unlinkSocialProvider } = useAuth();
    const { startTour } = useTour();
    const { t } = useTranslation();
    const currentOrgId = localStorage.getItem('organization_id') || '1';
    const [activeTab, setActiveTab] = useState<'organization' | 'members' | 'profile' | 'integrations' | 'downloads' | 'notifications'>('organization');
    const [organization, setOrganization] = useState<any>(null);
    const [orgSettings, setOrgSettings] = useState<{ lowStockThreshold: number | null, lowStockThresholdType: string, aiAlertCooldownHours?: number | null }>({ lowStockThreshold: null, lowStockThresholdType: 'GRAMS' });
    const [saving, setSaving] = useState(false);
    const [upgrading, setUpgrading] = useState(false);
    const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
    const [members, setMembers] = useState<Member[]>([]);
    const [userRole, setUserRole] = useState<'owner' | 'admin' | 'member' | null>(null);
    const [apiKeys, setApiKeys] = useState<ApiKeySummary[]>([]);
    const [apiKeyScopes, setApiKeyScopes] = useState<string[]>([]);
    const [newApiKey, setNewApiKey] = useState('');
    const rememberedApiKeys: Record<string, string> = {};
    const [apiKeyName, setApiKeyName] = useState('Application tierce');
    const [selectedApiScopes, setSelectedApiScopes] = useState<string[]>(['filaments:read', 'stock:read']);
    const [apiKeyExpiresAt, setApiKeyExpiresAt] = useState('');
    const exampleApiKey = newApiKey || 'sk_zsp_xxx';
    const publicApiExample = `curl ${BASE_URL}/public-api/v1/filaments -H "Authorization: Bearer ${exampleApiKey}"`;
    const orcaCommand = publicApiExample;
    const publicDocsUrl = `${BASE_URL}/public-api/docs`;
    const formatTokenPreview = (token: string) =>
        token.length > 24 ? `${token.slice(0, 18)}...${token.slice(-6)}` : token;

    const isAdminOrOwner = user?.isSuperAdmin || userRole === 'owner' || userRole === 'admin';
    const scopeDescriptions: Record<string, string> = {
        'filaments:read': 'Lire les bobines et leurs informations publiques.',
        'filaments:write': 'Creer ou modifier des bobines via API publique.',
        'stock:read': 'Lire les indicateurs de stock.',
        'stock:write': 'Mettre a jour le poids restant.',
        'consumption:read': 'Lire l historique de consommation.',
        'consumption:write': 'Ajouter des consommations.',
        'analytics:read': 'Lire les agregats analytiques.',
        'projects:read': 'Lire les projets exposes publiquement.',
        'projects:write': 'Creer ou modifier des projets exposes publiquement.',
        'gcode:inspect': 'Analyser des fichiers G-code via integration publique.',
    };

    useEffect(() => {
        const query = new URLSearchParams(window.location.search);
        if (query.get('success')) {
            alert(t('settings.alerts.upgradeSuccess', 'Subscription updated successfully! Your new limits are now active.'));
            setHistoryRefreshKey(prev => prev + 1);
            // Clear URL params
            window.history.replaceState({}, document.title, window.location.pathname);
            fetchOrganization();
        }
        if (query.get('canceled')) {
            alert(t('settings.alerts.upgradeCanceled', 'Upgrade canceled.'));
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    const fetchMembers = async () => {
        const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const response = await fetch(`${BASE_URL}/organizations/${currentOrgId}/users`, {
            headers: { 'Authorization': `Bearer ${token}`, 'x-organization-id': currentOrgId },
        });
        if (response.ok) {
            const data = await response.json();
            setMembers(data);
        }
    };
    const [inviteEmail, setInviteEmail] = useState('');
    const [profileData, setProfileData] = useState({
        displayName: user?.displayName || '',
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        email: user?.email || '',
        newPassword: '',
        notifyOnNewSpool: user?.notifyOnNewSpool ?? true,
        notifyOnConsumption: user?.notifyOnConsumption ?? true,
        notifyOnSystem: user?.notifyOnSystem ?? true,
        notifyOnLowStock: user?.notifyOnLowStock ?? true,
        notifyOnInvitation: user?.notifyOnInvitation ?? true,
        notifyOnAiRupture: user?.notifyOnAiRupture ?? true,
        notifyOnAiAchat: user?.notifyOnAiAchat ?? true,
        notifyOnAiProjet: user?.notifyOnAiProjet ?? true,
    });
    const [showProfilePassword, setShowProfilePassword] = useState(false);
    const currentOrg = user?.organisations?.find((o) => String(o.id) === String(currentOrgId));
    const [orgAiAlertsEnabled, setOrgAiAlertsEnabled] = useState(currentOrg?.notifyOnAiAlerts ?? true);
    const handleToggleOrgAiAlerts = async (enabled: boolean) => {
        setOrgAiAlertsEnabled(enabled);
        try {
            await api.setOrgAiAlertsPreference(Number(currentOrgId), enabled);
            updateUser({
                organisations: (user?.organisations || []).map((o) =>
                    String(o.id) === String(currentOrgId) ? { ...o, notifyOnAiAlerts: enabled } : o,
                ),
            });
        } catch (error: any) {
            setOrgAiAlertsEnabled(!enabled); // rollback en cas d'echec
            alert(
                'Impossible de mettre à jour ce réglage. Vérifie que le serveur API a été redémarré et que la migration a été appliquée.\n\nDétail: ' +
                    (error?.message || 'erreur inconnue'),
            );
        }
    };
    const [deleteAccountModal, setDeleteAccountModal] = useState(false);
    const [deleteConfirmWord, setDeleteConfirmWord] = useState('');
    const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
    const [deletingAccount, setDeletingAccount] = useState(false);

    const handleLinkGoogle = () => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!clientId || !window.google) {
            alert(t('settings.googleUnavailable', 'Google Sign-In is not available on this page.'));
            return;
        }

        window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response: any) => {
                try {
                    await linkSocialProvider('google', response.credential);
                    alert(t('settings.googleLinkedSuccess', 'Google account linked.'));
                } catch (error: any) {
                    alert(error?.message || t('settings.socialLinkFailed', 'Could not link this account.'));
                }
            },
        });
        window.google.accounts.id.prompt();
    };

    const handleUnlinkSocial = async (provider: 'google' | 'apple') => {
        const providerName = provider === 'apple' ? 'Apple' : 'Google';
        if (!confirm(t('settings.unlinkSocialMessage', 'Remove the {{provider}} connection from this account?', { provider: providerName }))) {
            return;
        }

        try {
            await unlinkSocialProvider(provider);
            alert(t('settings.socialUnlinked', 'Social connection unlinked.'));
        } catch (error: any) {
            alert(error?.message || t('settings.socialUnlinkFailed', 'Could not unlink this account.'));
        }
    };

    useEffect(() => {
        if (user) {
            setProfileData({
                displayName: user.displayName || '',
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                email: user.email || '',
                newPassword: '',
                notifyOnNewSpool: user.notifyOnNewSpool ?? true,
                notifyOnConsumption: user.notifyOnConsumption ?? true,
                notifyOnSystem: user.notifyOnSystem ?? true,
                notifyOnLowStock: user.notifyOnLowStock ?? true,
                notifyOnInvitation: user.notifyOnInvitation ?? true,
                notifyOnAiRupture: user.notifyOnAiRupture ?? true,
                notifyOnAiAchat: user.notifyOnAiAchat ?? true,
                notifyOnAiProjet: user.notifyOnAiProjet ?? true,
            });
            const org = user.organisations?.find((o) => String(o.id) === String(currentOrgId));
            setOrgAiAlertsEnabled(org?.notifyOnAiAlerts ?? true);
        }
    }, [user]);

    const saveProfile = async () => {
        setSaving(true);
        try {

            const res = await fetch(`${BASE_URL}/auth/profile`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    displayName: profileData.displayName,
                    firstName: profileData.firstName,
                    lastName: profileData.lastName,
                    email: profileData.email,
                    notifyOnNewSpool: profileData.notifyOnNewSpool,
                    notifyOnConsumption: profileData.notifyOnConsumption,
                    notifyOnSystem: profileData.notifyOnSystem,
                    notifyOnLowStock: profileData.notifyOnLowStock,
                    notifyOnInvitation: profileData.notifyOnInvitation,
                    notifyOnAiRupture: profileData.notifyOnAiRupture,
                    notifyOnAiAchat: profileData.notifyOnAiAchat,
                    notifyOnAiProjet: profileData.notifyOnAiProjet,
                    ...(profileData.newPassword ? { password: profileData.newPassword } : {})
                })
            });
            if (res.ok) {
                const updatedUser = await res.json();
                updateUser(updatedUser);
                alert(t('settings.alerts.profileUpdated') || 'Profile updated successfully');
            }
        } catch (err) {
            console.error("Failed to save profile", err);
        } finally {
            setSaving(false);
        }
    };

    const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');

    useEffect(() => {
        if (activeTab === 'organization') {
            fetchOrganization();
            fetchMembers();
        }
        if (activeTab === 'integrations') {
            fetchApiKeys();
            fetchApiKeyScopes();
        }
    }, [activeTab]);

    const fetchApiKeys = async () => {
        try {
            setApiKeys(await api.getApiKeys());
        } catch (err) {
            console.error("Failed to fetch API keys", err);
        }
    };

    const fetchApiKeyScopes = async () => {
        try {
            const result = await api.getApiKeyScopes();
            setApiKeyScopes(result.data);
            setSelectedApiScopes(prev => prev.length ? prev : result.data.filter(scope => ['filaments:read', 'stock:read'].includes(scope)));
        } catch (err) {
            console.error("Failed to fetch API key scopes", err);
        }
    };

    const toggleApiScope = (scope: string) => {
        setSelectedApiScopes(prev =>
            prev.includes(scope)
                ? prev.filter(item => item !== scope)
                : [...prev, scope]
        );
    };

    const createApiKey = async () => {
        if (!selectedApiScopes.length) {
            alert('Selectionne au moins un scope.');
            return;
        }
        try {
            const result = await api.createApiKey({
                name: apiKeyName || 'Application tierce',
                scopes: selectedApiScopes,
                expiresAt: apiKeyExpiresAt ? new Date(apiKeyExpiresAt).toISOString() : null,
            });
            setNewApiKey(result.key);
            setApiKeys(prev => [result.apiKey, ...prev]);
        } catch (err: any) {
            alert(err?.message || 'Impossible de créer la clé API');
        }
    };

    const revokeApiKey = async (id: number) => {
        if (!confirm('Révoquer cette clé API ?')) return;
        try {
            const revoked = await api.revokeApiKey(id);
            setApiKeys(prev => prev.map(key => key.id === id ? revoked : key));
        } catch (err: any) {
            alert(err?.message || 'Impossible de révoquer la clé API');
        }
    };

    const deleteApiKey = async (id: number) => {
        if (!confirm('Supprimer cette cle de la liste ?')) return;
        try {
            await api.deleteApiKey(id);
            setApiKeys(prev => prev.filter(key => key.id !== id));
        } catch (err: any) {
            alert(err?.message || 'Impossible de supprimer la cle API');
        }
    };

    const fetchOrganization = async () => {
        try {
            // Fetch Role first
            const roleRes = await fetch(`${BASE_URL}/organizations/${currentOrgId}/my-role`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'x-organization-id': currentOrgId
                }
            });
            if (roleRes.ok) {
                const roleData = await roleRes.json();
                setUserRole(roleData.role);
            }

            const res = await fetch(`${BASE_URL}/organizations/${currentOrgId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'x-organization-id': currentOrgId
                }
            });
            if (res.ok) {
                const data = await res.json();
                setOrganization(data);
                setOrgSettings(data.settings || { lowStockThreshold: null, lowStockThresholdType: 'GRAMS' });
            }
        } catch (err) {
            console.error("Failed to fetch organization or role", err);
        }
    };

    const saveOrgSettings = async () => {
        setSaving(true);
        try {

            const res = await fetch(`${BASE_URL}/organizations/${currentOrgId}/settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'x-organization-id': currentOrgId
                },
                body: JSON.stringify({ settings: orgSettings })
            });
            if (res.ok) {
                alert(t('settings.alerts.settingsSaved'));
            }
        } catch (err) {
            console.error("Failed to save settings", err);
        } finally {
            setSaving(false);
        }
    };


    const [uploadingLogo, setUploadingLogo] = useState(false);

    // ...

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) { // 2MB limit
            alert(t('settings.logoSizeLimit') || "File too large. Max 2MB.");
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        setUploadingLogo(true);
        try {
            const res = await fetch(`${BASE_URL}/organizations/${currentOrgId}/logo`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    // 'Content-Type': 'multipart/form-data' // Let browser set boundary
                },
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                // Update local organization state
                setOrganization((prev: any) => ({ ...prev, logo: data.logo }));
                alert(t('settings.logoUploaded') || "Logo uploaded successfully");
            } else {
                alert(t('settings.logoUploadFailed') || "Failed to upload logo");
            }
        } catch (err) {
            console.error("Failed to upload logo", err);
            alert(t('settings.logoUploadFailed') || "Failed to upload logo");
        } finally {
            setUploadingLogo(false);
        }
    };

    const [deletingLogo, setDeletingLogo] = useState(false);

    const handleRemoveLogo = async () => {
        if (!confirm(t('settings.confirmRemoveLogo') || "Are you sure you want to remove the logo?")) return;

        setDeletingLogo(true);
        try {
            const res = await fetch(`${BASE_URL}/organizations/${currentOrgId}/logo`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.ok) {
                setOrganization((prev: any) => ({ ...prev, logo: null }));
                alert(t('settings.logoRemoved') || "Logo removed successfully");
            } else {
                alert(t('settings.logoRemoveFailed') || "Failed to remove logo");
            }
        } catch (err) {
            console.error("Failed to remove logo", err);
        } finally {
            setDeletingLogo(false);
        }
    };

    const handleUpgrade = async (plan: 'pro' | 'enterprise') => {
        setUpgrading(true);
        try {
            // If the organization already has an active Stripe subscription, use the direct upgrade path
            if (organization?.stripeSubscriptionId) {
                const res = await fetch(`${BASE_URL}/stripe/upgrade`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'x-organization-id': currentOrgId
                    },
                    body: JSON.stringify({
                        plan,
                        organizationId: parseInt(currentOrgId)
                    })
                });

                if (res.ok) {
                    const { url } = await res.json();
                    window.location.href = url;
                } else {
                    const data = await res.json().catch(() => ({}));
                    alert(t('settings.alerts.upgradeError', data.message || 'Failed to update subscription.'));
                }
                return;
            }

            // Otherwise, create a new checkout session (Free -> Pro/Enterprise)
            const res = await fetch(`${BASE_URL}/stripe/create-checkout-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'x-organization-id': currentOrgId
                },
                body: JSON.stringify({
                    plan,
                    organizationId: parseInt(currentOrgId)
                })
            });

            if (res.ok) {
                const { url } = await res.json();
                window.location.href = url;
            } else {
                alert(t('settings.alerts.upgradeError', 'Failed to create checkout session.'));
            }
        } catch (err) {
            console.error("Failed to start upgrade", err);
            alert(t('settings.alerts.upgradeError'));
        } finally {
            setUpgrading(false);
        }
    };

    const handleManageSubscription = async () => {
        setUpgrading(true);
        try {
            const res = await fetch(`${BASE_URL}/stripe/create-portal-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    organizationId: parseInt(currentOrgId)
                })
            });

            if (res.ok) {
                const { url } = await res.json();
                window.open(url, '_blank');
            } else {
                // Parse the message if possible
                const data = await res.json().catch(() => ({}));
                alert(t('settings.alerts.portalError', data.message || 'Failed to open subscription portal.'));
            }
        } catch (err) {
            console.error("Failed to open portal", err);
            alert(t('settings.alerts.portalError', 'Network error.'));
        } finally {
            setUpgrading(false);
        }
    };

    const inviteMember = async () => {
        if (!inviteEmail.trim()) return;

        try {

            const response = await fetch(`${BASE_URL}/organizations/${currentOrgId}/members`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'x-organization-id': currentOrgId
                },
                body: JSON.stringify({
                    email: inviteEmail,
                    role: inviteRole,
                }),
            });

            if (response.ok) {
                setInviteEmail('');
                fetchMembers();
                alert(t('settings.alerts.memberInvited'));
            } else {
                // Try to parse error message
                const err = await response.json().catch(() => ({}));
                if (err.message === 'User not found' || response.status === 404) {
                    alert(t('settings.alerts.userNotFound'));
                } else {
                    alert(t('settings.alerts.inviteFailed'));
                }
            }
        } catch (error) {
            console.error('Failed to invite member:', error);
            alert(t('settings.alerts.inviteFailed'));
        }
    };

    const deleteOrg = async () => {
        if (!confirm(t('settings.confirmDeleteOrg'))) return;

        try {
            await api.deleteOrganization(Number(currentOrgId));
            alert('Organization deleted');
            localStorage.removeItem('organization_id');
            window.location.href = '/';
        } catch (err) {
            console.error("Failed to delete org", err);
            alert(t('common.error'));
        }
    };

    const removeMember = async (memberId: number) => {
        try {

            const response = await fetch(`${BASE_URL}/organizations/${currentOrgId}/members/${memberId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'x-organization-id': currentOrgId
                },
            });

            if (response.ok) {
                fetchMembers();
                alert(t('settings.alerts.memberRemoved'));
            } else {
                alert(t('settings.alerts.removeFailed'));
            }
        } catch (error) {
            console.error('Failed to remove member:', error);
            alert(t('settings.alerts.removeFailed'));
        }
    };

    return (
        <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
            <PageHeader 
                title={t('settings.title')}
                icon={SettingsIcon}
            />


            <PendingInvitations />

            {/* Tabs */}
            <div style={{
                display: 'flex',
                gap: '8px',
                borderBottom: '2px solid #e5e7eb',
                marginBottom: '24px',
            }}>
                {[
                    { id: 'organization', label: t('settings.tabs.organization'), icon: <Building size={16} /> },
                    { id: 'profile', label: t('settings.tabs.profile'), icon: <User size={16} /> },
                    { id: 'notifications', label: t('settings.tabs.notifications', 'Notifications'), icon: <Bell size={16} /> },
                    { id: 'integrations', label: 'Intégrations', icon: <KeyRound size={16} /> },
                    { id: 'downloads', label: t('settings.tabs.downloads'), icon: <Download size={16} /> },
                ].map(tab => (
                    <>
                    {/*
                    {false && <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px', marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
                            {t('settings.socialConnections', 'Connexions sociales')}
                        </h3>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '16px',
                            padding: '12px',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            marginBottom: '8px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <GoogleIcon size={18} />
                                <div>
                                <div style={{ fontWeight: 600 }}>Google</div>
                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                    {user?.googleId ? t('settings.linked', 'Lié') : t('settings.notLinked', 'Non lié')}
                                </div>
                                </div>
                                </div>
                                </div>
                                </div>
                            </div>
                                </div>
                            </div>
                            </div>
                            </div>
                            </div>
                            {user?.googleId ? (
                                <button
                                    type="button"
                                    onClick={() => handleUnlinkSocial('google')}
                                    style={{
                                        padding: '8px 12px',
                                        backgroundColor: '#ef4444',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontWeight: 600
                                    }}
                                >
                                    {t('settings.unlink', 'Délier')}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleLinkGoogle}
                                    style={{
                                        padding: '8px 12px',
                                        backgroundColor: '#1661af',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontWeight: 600
                                    }}
                                >
                                    {t('settings.linkGoogle', 'Lier Google')}
                                </button>
                            )}
                        </div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '16px',
                            padding: '12px',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px'
                        }}>
                            <div>
                                <div style={{ fontWeight: 600 }}>Apple</div>
                                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                    {user?.appleId
                                        ? t('settings.linked', 'Lié')
                                        : t('settings.appleLinkMobileOnly', 'À lier depuis l’app iOS')}
                                </div>
                                </div>
                            </div>
                            </div>
                            </div>
                            </div>
                            {user?.appleId && (
                                <button
                                    type="button"
                                    onClick={() => handleUnlinkSocial('apple')}
                                    style={{
                                        padding: '8px 12px',
                                        backgroundColor: '#ef4444',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontWeight: 600
                                    }}
                                >
                                    {t('settings.unlink', 'Délier')}
                                </button>
                            )}
                        </div>
                    </div>}
                    */}

                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        style={{
                            padding: '12px 24px',
                            border: 'none',
                            background: 'none',
                            borderBottom: activeTab === tab.id ? '2px solid #6366f1' : '2px solid transparent',
                            color: activeTab === tab.id ? '#6366f1' : '#6b7280',
                            fontWeight: activeTab === tab.id ? '600' : '400',
                            cursor: 'pointer',
                            marginBottom: '-2px',
                        }}
                    >
                        <span style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                        }}>
                            {tab.icon}
                            {tab.id === 'integrations' ? 'API publique' : tab.label}
                        </span>

                    </button>
                    </>
                ))}
            </div>

            {/* Organization Tab */}
            {activeTab === 'organization' && (
                <div style={{
                    backgroundColor: 'white',
                    padding: '24px',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                }}>
                    <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>
                        {t('settings.orgSettings')}
                    </h2>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                            {t('settings.currentOrg')}
                        </label>
                        <OrganizationSwitcher />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                            {t('settings.lowStockThreshold')}
                        </label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                                type="number"
                                value={orgSettings.lowStockThreshold === null ? '' : orgSettings.lowStockThreshold}
                                onChange={(e) => setOrgSettings(prev => ({ ...prev, lowStockThreshold: e.target.value === '' ? null : Number(e.target.value) }))}
                                disabled={!isAdminOrOwner}
                                style={{
                                    padding: '10px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    width: '100px',
                                    backgroundColor: !isAdminOrOwner ? '#f3f4f6' : 'white'
                                }}
                            />
                            <select
                                value={orgSettings.lowStockThresholdType || 'GRAMS'}
                                onChange={(e) => setOrgSettings(prev => ({ ...prev, lowStockThresholdType: e.target.value }))}
                                disabled={!isAdminOrOwner}
                                style={{
                                    padding: '10px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    backgroundColor: !isAdminOrOwner ? '#f3f4f6' : 'white'
                                }}
                            >
                                <option value="GRAMS">g</option>
                                <option value="PERCENTAGE">%</option>
                            </select>

                            {isAdminOrOwner && (
                                <button
                                    onClick={saveOrgSettings}
                                    disabled={saving}
                                    style={{
                                        padding: '10px 20px',
                                        backgroundColor: '#6366f1',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontWeight: '500',
                                        opacity: saving ? 0.7 : 1,
                                        marginLeft: '8px'
                                    }}
                                >
                                    {saving ? t('common.loading') : t('common.save')}
                                </button>
                            )}
                        </div>
                        <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
                            {t('settings.lowStockThresholdDesc')}
                        </p>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                            Délai anti-répétition des alertes IA (heures)
                        </label>
                        <input
                            type="number"
                            min={1}
                            placeholder="72"
                            value={orgSettings.aiAlertCooldownHours == null ? '' : orgSettings.aiAlertCooldownHours}
                            onChange={(e) => setOrgSettings(prev => ({ ...prev, aiAlertCooldownHours: e.target.value === '' ? null : Number(e.target.value) }))}
                            disabled={!isAdminOrOwner}
                            style={{ width: '120px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                        />
                        <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
                            Une même alerte IA n'est pas renvoyée avant ce délai (sauf aggravation). Vide = valeur par défaut (72h).
                        </p>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                            {t('settings.organizationLogo') || "Organization Logo"}
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            {organization?.logo ? (
                                <SecureImage
                                    src={organization.logo}
                                    alt="Organization Logo"
                                    style={{ maxHeight: '60px', maxWidth: '200px', objectFit: 'contain', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '4px' }}
                                />
                            ) : (
                                <div style={{
                                    width: '120px', height: '60px',
                                    backgroundColor: '#f3f4f6',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#6b7280', fontSize: '12px',
                                    borderRadius: '4px', border: '1px dashed #d1d5db'
                                }}>
                                    {t('settings.noLogo') || "No Logo"}
                                </div>
                            )}

                            <div>
                                <input
                                    type="file"
                                    id="logo-upload"
                                    accept=".png, .jpg, .jpeg, .gif"
                                    style={{ display: 'none' }}
                                    onChange={handleLogoUpload}
                                    disabled={uploadingLogo}
                                />
                                {isAdminOrOwner && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <label
                                            htmlFor="logo-upload"
                                            style={{
                                                display: 'inline-block',
                                                padding: '8px 16px',
                                                backgroundColor: '#fff',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '6px',
                                                cursor: uploadingLogo ? 'wait' : 'pointer',
                                                fontSize: '14px',
                                                fontWeight: '500',
                                                color: '#374151'
                                            }}
                                        >
                                            {uploadingLogo ? (t('common.uploading') || "Uploading...") : (organization?.logo ? (t('settings.replaceLogo') || "Replace Logo") : (t('settings.uploadLogo') || "Upload Logo"))}
                                        </label>

                                        {organization?.logo && (
                                            <button
                                                onClick={handleRemoveLogo}
                                                disabled={deletingLogo}
                                                title={t('settings.removeLogo') || "Remove Logo"}
                                                style={{
                                                    padding: '8px',
                                                    backgroundColor: '#fee2e2',
                                                    border: '1px solid #fca5a5',
                                                    borderRadius: '6px',
                                                    color: '#ef4444',
                                                    cursor: deletingLogo ? 'wait' : 'pointer',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                )}
                                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                                    {t('settings.logoRequirements') || "Recommended: PNG transparent, height 50px."}
                                </p>
                            </div>
                        </div>
                    </div>


                    <div style={{ marginBottom: '32px' }}>
                            <label style={{ display: 'block', marginBottom: '16px', fontWeight: '600', fontSize: '18px', color: '#111827' }}>
                                {t('settings.plan')}
                            </label>
                        <div style={{
                            background: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)',
                            borderRadius: '16px',
                            padding: '28px',
                            color: 'white',
                            boxShadow: '0 10px 25px -5px rgba(67, 56, 202, 0.4)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '24px',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            {/* Background decorations */}
                            <div style={{
                                position: 'absolute',
                                top: '-50px',
                                right: '-50px',
                                width: '250px',
                                height: '250px',
                                background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 70%)',
                                borderRadius: '50%',
                                pointerEvents: 'none'
                            }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 1, flexWrap: 'wrap', gap: '16px' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                        <h3 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, textTransform: 'capitalize', letterSpacing: '-0.5px' }}>
                                            {organization?.plan || 'free'} Plan
                                        </h3>
                                        {organization?.plan === 'beta' && <span style={{ padding: '2px 8px', backgroundColor: 'rgba(255,255,255,0.2)', fontSize: '12px', borderRadius: '12px', fontWeight: '600' }}>BETA</span>}
                                        {(organization?.isStripeSubscriptionCanceled && organization?.plan !== 'free') && <span style={{ padding: '2px 8px', backgroundColor: '#ef4444', color: 'white', fontSize: '10px', borderRadius: '12px', fontWeight: '600', textTransform: 'uppercase' }}>{t('settings.status.downgrading', 'En cours de modification')}</span>}
                                    </div>
                                    <p style={{ margin: 0, opacity: 0.85, fontSize: '15px' }}>
                                        {organization?.plan === 'pro' && t('settings.proPlanDetails', 'Inclus : Jusqu\'à {{spools}} bobines et {{users}} utilisateurs.', { spools: organization?.stats?.limits?.maxSpoolsPerOrg || 100, users: organization?.stats?.limits?.maxMembersPerOrg || 20 })}
                                        {organization?.plan === 'free' && (
                                            <>
                                                {t('settings.freePlanDetails', 'Inclus : Jusqu\'à {{spools}} bobines, analytics inclus, et {{users}} utilisateurs.', { spools: organization?.stats?.limits?.maxSpoolsPerOrg || 30, users: organization?.stats?.limits?.maxMembersPerOrg || 3 })}
                                                <br />
                                                <strong style={{ color: '#fbbf24' }}>🎁 14 jours d'essai gratuits sur les plans Pro et Enterprise !</strong>
                                            </>
                                        )}
                                        {organization?.plan === 'beta' && t('settings.betaPlanDetails', 'Plan Beta')}
                                        {organization?.plan === 'enterprise' && t('settings.enterprisePlanDetails', 'Inclus : Bobines et utilisateurs illimités.')}

                                        {(organization?.trialEndsAt || organization?.stripeSubscriptionEndDate || organization?.manualPlanEndDate) && (
                                            <div style={{ marginTop: '12px', fontSize: '13px', background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '8px', display: 'inline-block' }}>
                                                📅 {t('admin.manualPlanEndDate')}: {new Date(organization.trialEndsAt || organization.stripeSubscriptionEndDate || organization.manualPlanEndDate).toLocaleDateString()}
                                            </div>
                                        )}
                                    </p>
                                </div>

                                {isAdminOrOwner && (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                    {organization?.plan === 'free' && (
                                        <>
                                            <button
                                                onClick={() => handleUpgrade('pro')}
                                                disabled={upgrading}
                                                style={{
                                                    padding: '10px 20px',
                                                    background: 'white',
                                                    color: '#4338ca',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    fontWeight: '600',
                                                    cursor: upgrading ? 'wait' : 'pointer',
                                                    opacity: upgrading ? 0.8 : 1,
                                                    transition: 'transform 0.2s',
                                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                                onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                            >
                                                {upgrading ? t('common.loading') : t('settings.tryProFree', 'Essayer Pro gratuitement')}
                                            </button>
                                            <button
                                                onClick={() => handleUpgrade('enterprise')}
                                                disabled={upgrading}
                                                style={{
                                                    padding: '10px 20px',
                                                    background: 'rgba(255,255,255,0.1)',
                                                    color: 'white',
                                                    border: '1px solid rgba(255,255,255,0.2)',
                                                    borderRadius: '8px',
                                                    fontWeight: '600',
                                                    cursor: upgrading ? 'wait' : 'pointer',
                                                    opacity: upgrading ? 0.7 : 1,
                                                    transition: 'background 0.2s',
                                                    backdropFilter: 'blur(10px)'
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                                                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                            >
                                                {upgrading ? t('common.loading') : 'Upgrade to Enterprise'}
                                            </button>
                                        </>
                                    )}
                                    {organization?.plan === 'pro' && (
                                        <>
                                            <button
                                                onClick={() => handleUpgrade('enterprise')}
                                                disabled={upgrading}
                                                style={{
                                                    padding: '10px 20px',
                                                    background: 'white',
                                                    color: '#4338ca',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    fontWeight: '600',
                                                    cursor: upgrading ? 'wait' : 'pointer',
                                                    opacity: upgrading ? 0.8 : 1,
                                                    transition: 'transform 0.2s',
                                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                                onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                            >
                                                {upgrading ? t('common.loading') : 'Upgrade to Enterprise'}
                                            </button>
                                            <button
                                                onClick={handleManageSubscription}
                                                disabled={upgrading}
                                                style={{
                                                    padding: '10px 20px',
                                                    background: 'rgba(255,255,255,0.1)',
                                                    color: 'white',
                                                    border: '1px solid rgba(255,255,255,0.2)',
                                                    borderRadius: '8px',
                                                    fontWeight: '600',
                                                    cursor: upgrading ? 'wait' : 'pointer',
                                                    opacity: upgrading ? 0.7 : 1,
                                                    transition: 'background 0.2s',
                                                    backdropFilter: 'blur(10px)'
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                                                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                            >
                                                {upgrading ? t('common.loading') : t('settings.manageSubscription', "Gérer")}
                                            </button>
                                        </>
                                    )}
                                    {organization?.plan === 'enterprise' && (
                                        <>
                                            <button
                                                onClick={() => handleUpgrade('pro')}
                                                disabled={upgrading}
                                                style={{
                                                    padding: '10px 20px',
                                                    background: 'white',
                                                    color: '#4338ca',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    fontWeight: '600',
                                                    cursor: upgrading ? 'wait' : 'pointer',
                                                    opacity: upgrading ? 0.8 : 1,
                                                    transition: 'transform 0.2s',
                                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                                onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                            >
                                                {upgrading ? t('common.loading') : 'Downgrade to Pro'}
                                            </button>
                                            <button
                                                onClick={handleManageSubscription}
                                                disabled={upgrading}
                                                style={{
                                                    padding: '10px 20px',
                                                    background: 'rgba(255,255,255,0.1)',
                                                    color: 'white',
                                                    border: '1px solid rgba(255,255,255,0.2)',
                                                    borderRadius: '8px',
                                                    fontWeight: '600',
                                                    cursor: upgrading ? 'wait' : 'pointer',
                                                    opacity: upgrading ? 0.7 : 1,
                                                    transition: 'background 0.2s',
                                                    backdropFilter: 'blur(10px)'
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                                                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                            >
                                                {upgrading ? t('common.loading') : t('settings.manageSubscription', "Gérer")}
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                            {(organization?.isStripeSubscriptionCanceled && organization?.plan !== 'free') && organization?.stripeSubscriptionEndDate && (
                                <div style={{
                                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    borderRadius: '8px',
                                    padding: '16px',
                                    marginTop: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    zIndex: 1
                                }}>
                                    <div style={{ color: '#fca5a5' }}>
                                        <Bell size={20} />
                                    </div>
                                    <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
                                        <strong>{t('settings.subscriptionCanceling', 'Abonnement en cours d\'annulation')}</strong><br />
                                        <span style={{ opacity: 0.9 }}>
                                            {t('settings.subscriptionCancelingDesc', 'Votre abonnement prendra fin le {{date}}.', { date: new Date(organization.stripeSubscriptionEndDate).toLocaleDateString() })}
                                        </span>
                                    </div>
                                    {isAdminOrOwner && (
                                        <button
                                            onClick={handleManageSubscription}
                                            style={{ marginLeft: 'auto', padding: '6px 14px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                                            {t('settings.renewSubscription', 'Renouveler')}
                                        </button>
                                    )}
                                </div>
                            )}

                            {organization?.stats && (
                                <div style={{
                                    display: 'flex',
                                    gap: '40px',
                                    paddingTop: '20px',
                                    borderTop: '1px solid rgba(255,255,255,0.15)',
                                    zIndex: 1
                                }}>
                                    <div>
                                        <div style={{ fontSize: '13px', opacity: 0.8, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            {t('common.spools', 'Spools')}
                                        </div>
                                        <div style={{ fontWeight: '700', fontSize: '24px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                            {organization.stats.activeSpoolsCount}
                                            <span style={{ fontSize: '16px', fontWeight: '500', opacity: 0.7 }}>
                                                / {organization.stats.limits?.maxSpoolsPerOrg === 999999 || organization.stats.limits?.maxSpoolsPerOrg === Infinity || organization.stats.limits?.maxSpoolsPerOrg === null ? '∞' : organization.stats.limits?.maxSpoolsPerOrg}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '13px', opacity: 0.8, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            {t('common.members', 'Members')}
                                        </div>
                                        <div style={{ fontWeight: '700', fontSize: '24px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                            {organization.stats.membersCount}
                                            <span style={{ fontSize: '16px', fontWeight: '500', opacity: 0.7 }}>/ {organization.stats.limits?.maxMembersPerOrg === 999999 || organization.stats.limits?.maxMembersPerOrg === Infinity || organization.stats.limits?.maxMembersPerOrg === null ? '∞' : organization.stats.limits?.maxMembersPerOrg}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '13px', opacity: 0.8, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            {t('common.projects', 'Projects')}
                                        </div>
                                        <div style={{ fontWeight: '700', fontSize: '24px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                            {organization.stats.projectsCount}
                                            <span style={{ fontSize: '16px', fontWeight: '500', opacity: 0.7 }}>/ {organization.stats.limits?.maxProjectsPerOrg === 999999 || organization.stats.limits?.maxProjectsPerOrg === Infinity || organization.stats.limits?.maxProjectsPerOrg === null ? '∞' : organization.stats.limits?.maxProjectsPerOrg}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        {isAdminOrOwner && (
                            <>
                                <SubscriptionHistory organizationId={currentOrgId} refreshTrigger={historyRefreshKey} />
                            </>
                        )}

                    {/* Members Section */}
                    <div style={{ marginTop: '32px', borderTop: '1px solid #e5e7eb', paddingTop: '24px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Users size={20} />
                            {t('settings.teamMembers')}
                        </h2>

                        {/* Invite Member */}
                        {isAdminOrOwner && (
                            <div style={{
                                padding: '16px',
                                backgroundColor: '#f9fafb',
                                borderRadius: '8px',
                                marginBottom: '24px',
                            }}>
                                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
                                    {t('settings.inviteMember')}
                                </h3>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <input
                                        type="email"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        placeholder={t('settings.placeholders.email')}
                                        style={{
                                            flex: 1,
                                            minWidth: '200px',
                                            padding: '10px',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '6px',
                                        }}
                                    />
                                    <select
                                        value={inviteRole}
                                        onChange={(e) => setInviteRole(e.target.value as any)}
                                        style={{
                                            padding: '10px',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '6px',
                                        }}
                                    >
                                        <option value="member">{t('common.member', 'Member')}</option>
                                        <option value="admin">{t('common.admin', 'Admin')}</option>
                                    </select>
                                    <button
                                        onClick={inviteMember}
                                        style={{
                                            padding: '10px 20px',
                                            backgroundColor: '#1661af',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: '500',
                                        }}
                                    >
                                        {t('settings.sendInvite')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Members Table */}
                        <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                            {/* Table Header */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '12px 16px',
                                backgroundColor: '#f9fafb',
                                borderBottom: '1px solid #e5e7eb',
                                fontWeight: '600',
                                fontSize: '13px',
                                color: '#6b7280',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                            }}>
                                <div style={{ flex: 2 }}>{t('settings.memberName', 'Utilisateur')}</div>
                                <div style={{ flex: 1, textAlign: 'center' }}>{t('settings.memberRole', 'Rôle')}</div>
                                {isAdminOrOwner && <div style={{ width: '100px', textAlign: 'center' }}>{t('common.actions', 'Actions')}</div>}
                            </div>

                            {/* Table Rows */}
                            {members.map((member, idx) => (
                                <div
                                    key={member.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '12px 16px',
                                        borderBottom: idx < members.length - 1 ? '1px solid #f3f4f6' : 'none',
                                        backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa',
                                    }}
                                >
                                    {/* User Info */}
                                    <div style={{ flex: 2 }}>
                                        <div style={{ fontWeight: '500', color: '#111827' }}>{member.username}</div>
                                    </div>

                                    {/* Role Badge */}
                                    <div style={{ flex: 1, textAlign: 'center' }}>
                                        {member.role !== 'owner' && isAdminOrOwner ? (
                                            <select
                                                value={member.role}
                                                onChange={async (e) => {
                                                    try {
                                                        await api.updateMemberRole(parseInt(currentOrgId), member.id, e.target.value as 'admin' | 'member');
                                                        fetchMembers();
                                                    } catch (err) {
                                                        alert('Failed to update role');
                                                    }
                                                }}
                                                style={{
                                                    padding: '4px 8px',
                                                    borderRadius: '6px',
                                                    border: '1px solid #d1d5db',
                                                    fontSize: '13px',
                                                    backgroundColor: 'white',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                <option value="member">{t('common.member', 'Member')}</option>
                                                <option value="admin">{t('common.admin', 'Admin')}</option>
                                            </select>
                                        ) : (
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '4px 12px',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                fontWeight: '600',
                                                textTransform: 'uppercase',
                                                ...(member.role === 'owner'
                                                    ? { backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }
                                                    : member.role === 'admin'
                                                        ? { backgroundColor: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' }
                                                        : { backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' })
                                            }}>
                                                {t(`common.${member.role}`, member.role)}
                                            </span>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    {isAdminOrOwner && (
                                        <div style={{ width: '100px', textAlign: 'center' }}>
                                            {member.role !== 'owner' && (
                                                <button
                                                    onClick={() => removeMember(member.id)}
                                                    style={{
                                                        padding: '4px 12px',
                                                        backgroundColor: '#fee2e2',
                                                        color: '#dc2626',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        fontSize: '13px',
                                                        fontWeight: '500',
                                                    }}>
                                                    {member.id === user?.id
                                                        ? t('settings.selfRemove', 'Quitter')
                                                        : t('settings.remove', 'Retirer')}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {members.length === 0 && (
                                <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>
                                    {t('settings.noMembers', 'Aucun membre')}
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: '8px', fontSize: '13px', color: '#9ca3af' }}>
                            {t('settings.currentMembers', 'Membres actuels')} : {members.length}
                        </div>
                    </div>

                    {isAdminOrOwner && (
                        <div style={{ marginTop: '32px', borderTop: '1px solid #e5e7eb', paddingTop: '24px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#dc2626' }}>
                                {t('settings.dangerZone')}
                            </label>
                            <button
                                onClick={deleteOrg}
                                style={{
                                    padding: '10px 16px',
                                    backgroundColor: '#fee2e2',
                                    color: '#dc2626',
                                    border: '1px solid #fecaca',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: '500',
                                }}>
                                {t('settings.deleteOrg')}
                            </button>
                        </div>
                    )}
                    </div>
                </div>
            )}



            {/* Profile Tab */}
            {activeTab === 'profile' && (
                <div style={{
                    backgroundColor: 'white',
                    padding: '24px',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                }}
                    data-tour="settings-profile-section"
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '600', margin: 0 }}>
                            {t('settings.profileSettings')}
                        </h2>
                        {false && user?.googleId && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '6px 12px',
                                backgroundColor: '#f3f4f6',
                                borderRadius: '20px',
                                border: '1px solid #e5e7eb',
                                fontSize: '13px',
                                fontWeight: '500',
                                color: '#374151'
                            }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                </svg>
                                {t('settings.googleLinked', 'Compte lié à Google')}
                            </div>
                        )}
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                            {t('settings.username')}
                        </label>
                        <input
                            type="text"
                            value={user?.username || ''}
                            disabled
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                backgroundColor: '#f9fafb',
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                            {t('settings.displayName', "Nom d'affichage")}
                        </label>
                        <input
                            type="text"
                            value={profileData.displayName}
                            onChange={(e) => setProfileData(prev => ({ ...prev, displayName: e.target.value }))}
                            placeholder={t('settings.placeholders.displayName', "Ex: Jean D.")}
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                            {t('settings.firstName')}
                        </label>
                        <input
                            type="text"
                            value={profileData.firstName}
                            onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                            placeholder={t('settings.placeholders.firstName')}
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                            {t('settings.lastName')}
                        </label>
                        <input
                            type="text"
                            value={profileData.lastName}
                            onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
                            placeholder={t('settings.placeholders.lastName')}
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                            {t('settings.email')}
                        </label>
                        <input
                            type="email"
                            value={profileData.email}
                            readOnly={true}
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                backgroundColor: '#f9fafb',
                                cursor: 'not-allowed',
                                color: '#6b7280',
                                pointerEvents: 'none'
                            }}
                        />
                        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                            {user?.googleId || user?.appleId 
                                ? t('settings.socialEmailNotice', 'L\'adresse e-mail est gérée par votre compte social.')
                                : t('settings.fixedEmailNotice', 'L\'adresse e-mail ne peut pas être modifiée car elle constitue votre identifiant unique.')}
                        </p>
                    </div>

                    <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px', marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
                            {t('settings.socialConnections', 'Connexions sociales')}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <GoogleIcon size={18} />
                                <div>
                                    <div style={{ fontWeight: 600 }}>Google</div>
                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                    {user?.googleId ? t('settings.linked', 'Lié') : t('settings.notLinked', 'Non lié')}
                                    </div>
                                </div>
                            </div>
                            {user?.googleId ? (
                                <button type="button" onClick={() => handleUnlinkSocial('google')} style={{ padding: '8px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                                    {t('settings.unlink', 'Délier')}
                                </button>
                            ) : (
                                <button type="button" onClick={handleLinkGoogle} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: '#1661af', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                                    <GoogleIcon size={16} />
                                    {t('settings.linkGoogle', 'Lier Google')}
                                </button>
                            )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '12px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <AppleIcon size={18} />
                                <div>
                                    <div style={{ fontWeight: 600 }}>Apple</div>
                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                    {user?.appleId ? t('settings.linked', 'Lié') : t('settings.appleLinkMobileOnly', 'À lier depuis l’app iOS')}
                                    </div>
                                </div>
                            </div>
                            {user?.appleId && (
                                <button type="button" onClick={() => handleUnlinkSocial('apple')} style={{ padding: '8px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                                    {t('settings.unlink', 'Délier')}
                                </button>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={saveProfile}
                        disabled={saving}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: '#6366f1',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '500',
                            marginBottom: '24px',
                            opacity: saving ? 0.7 : 1
                        }}
                    >
                        {saving ? t('common.loading') : t('settings.saveProfile')}
                    </button>

                    <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>{t('settings.preferences') || 'Preferences'}</h3>

                        <button
                            onClick={() => startTour()}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: 'white',
                                color: '#6366f1',
                                border: '1px solid #6366f1',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <Eye size={18} />
                            {t('settings.restartTour') || 'Restart App Tour'}
                        </button>
                    </div>

                    {!user?.googleId && (
                        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                                {t('settings.changePassword')}
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showProfilePassword ? "text" : "password"}
                                    value={profileData.newPassword}
                                    onChange={(e) => setProfileData(prev => ({ ...prev, newPassword: e.target.value }))}
                                    placeholder={t('settings.newPassword')}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        paddingRight: '40px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px',
                                        marginBottom: '8px',
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowProfilePassword(!showProfilePassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '10px',
                                        top: '10px', // Adjusted to align with input padding
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: '#6b7280',
                                        padding: 0,
                                    }}
                                >
                                    {showProfilePassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                            <button
                                onClick={saveProfile}
                                disabled={saving}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#6366f1',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: '500',
                                }}
                            >
                                {t('settings.updatePassword')}
                            </button>
                        </div>
                    )}

                    {/* Danger Zone */}
                    <div style={{ borderTop: '2px solid #fecaca', paddingTop: '16px', marginTop: '24px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#dc2626' }}>
                            {t('settings.dangerZone', 'Zone de danger')}
                        </h3>
                        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '12px' }}>
                            {t('settings.deleteAccountDesc', 'La suppression de votre compte est définitive et irréversible. Toutes vos données personnelles seront effacées.')}
                        </p>
                        <button
                            onClick={() => {
                                const words = ['SUPPRIMER', 'EFFACER', 'CONFIRMER', 'DELETE', 'REMOVE'];
                                const word = words[Math.floor(Math.random() * words.length)];
                                setDeleteConfirmWord(word);
                                setDeleteConfirmInput('');
                                setDeleteAccountModal(true);
                            }}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: 'white',
                                color: '#dc2626',
                                border: '1px solid #dc2626',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <Trash2 size={18} />
                            {t('settings.deleteAccount', 'Supprimer mon compte')}
                        </button>
                    </div>
                </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
                <div style={{
                    backgroundColor: 'white',
                    padding: '24px',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                }}>
                    <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Bell size={20} />
                        {t('settings.tabs.notifications', 'Préférences de Notifications')}
                    </h2>

                    <div style={{ marginBottom: '24px', color: '#6b7280', fontSize: '14px' }}>
                        {t('settings.notificationsDesc', 'Choisissez les événements pour lesquels vous souhaitez être averti (Push Mobile & Cloche Web).')}
                    </div>

                    <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                            <input
                                type="checkbox"
                                checked={profileData.notifyOnNewSpool}
                                onChange={(e) => setProfileData(prev => ({ ...prev, notifyOnNewSpool: e.target.checked }))}
                                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#6366f1' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: '600', color: '#111827' }}>{t('settings.notifyOnNewSpool', 'Nouvelles Bobines')}</span>
                                <span style={{ fontSize: '13px', color: '#6b7280' }}>Être notifié lorsqu'un membre ajoute une nouvelle bobine à l'inventaire.</span>
                            </div>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                            <input
                                type="checkbox"
                                checked={profileData.notifyOnConsumption}
                                onChange={(e) => setProfileData(prev => ({ ...prev, notifyOnConsumption: e.target.checked }))}
                                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#6366f1' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: '600', color: '#111827' }}>{t('settings.notifyOnConsumption', 'Consommations')}</span>
                                <span style={{ fontSize: '13px', color: '#6b7280' }}>Être averti quand quelqu'un (autre que vous) enregistre une utilisation.</span>
                            </div>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                            <input
                                type="checkbox"
                                checked={profileData.notifyOnSystem}
                                onChange={(e) => setProfileData(prev => ({ ...prev, notifyOnSystem: e.target.checked }))}
                                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#6366f1' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: '600', color: '#111827' }}>Alertes Système</span>
                                <span style={{ fontSize: '13px', color: '#6b7280' }}>Recevez les annonces globales envoyées par les administrateurs du système.</span>
                            </div>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                            <input
                                type="checkbox"
                                checked={profileData.notifyOnLowStock}
                                onChange={(e) => setProfileData(prev => ({ ...prev, notifyOnLowStock: e.target.checked }))}
                                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#6366f1' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: '600', color: '#111827' }}>Stock Faible</span>
                                <span style={{ fontSize: '13px', color: '#6b7280' }}>Être prévenu lorsque le stock d'une bobine passe sous le seuil d'alerte.</span>
                            </div>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                            <input
                                type="checkbox"
                                checked={profileData.notifyOnInvitation}
                                onChange={(e) => setProfileData(prev => ({ ...prev, notifyOnInvitation: e.target.checked }))}
                                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#6366f1' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: '600', color: '#111827' }}>Invitations d'Organisation</span>
                                <span style={{ fontSize: '13px', color: '#6b7280' }}>Recevoir une alerte lorsque vous êtes invité à rejoindre une nouvelle communauté/entreprise.</span>
                            </div>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                            <input
                                type="checkbox"
                                checked={profileData.notifyOnAiRupture}
                                onChange={(e) => setProfileData(prev => ({ ...prev, notifyOnAiRupture: e.target.checked }))}
                                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#6366f1' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: '600', color: '#111827' }}>Alerte IA · Rupture imminente</span>
                                <span style={{ fontSize: '13px', color: '#6b7280' }}>L'assistant vous prévient lorsqu'une bobine va bientôt être en rupture.</span>
                            </div>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                            <input
                                type="checkbox"
                                checked={profileData.notifyOnAiAchat}
                                onChange={(e) => setProfileData(prev => ({ ...prev, notifyOnAiAchat: e.target.checked }))}
                                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#6366f1' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: '600', color: '#111827' }}>Alerte IA · Achat à prévoir</span>
                                <span style={{ fontSize: '13px', color: '#6b7280' }}>Recevoir une suggestion de commande quand un réapprovisionnement devient urgent.</span>
                            </div>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                            <input
                                type="checkbox"
                                checked={profileData.notifyOnAiProjet}
                                onChange={(e) => setProfileData(prev => ({ ...prev, notifyOnAiProjet: e.target.checked }))}
                                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#6366f1' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: '600', color: '#111827' }}>Alerte IA · Projet à risque</span>
                                <span style={{ fontSize: '13px', color: '#6b7280' }}>Être averti lorsqu'un projet planifié n'a plus assez de stock pour ses besoins.</span>
                            </div>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px', backgroundColor: '#eef2ff', borderRadius: '8px', border: '1px solid #c7d2fe' }}>
                            <input
                                type="checkbox"
                                checked={orgAiAlertsEnabled}
                                onChange={(e) => handleToggleOrgAiAlerts(e.target.checked)}
                                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#6366f1' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: '600', color: '#111827' }}>Alertes IA pour « {currentOrg?.name || 'cette organisation'} »</span>
                                <span style={{ fontSize: '13px', color: '#6b7280' }}>Coupe toutes les alertes IA de l'organisation actuellement sélectionnée (pour en régler une autre, sélectionne-la d'abord).</span>
                            </div>
                        </label>
                    </div>

                    <button
                        onClick={saveProfile}
                        disabled={saving}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: '#6366f1',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '500',
                            display: 'inline-flex',
                            alignItems: 'center',
                            opacity: saving ? 0.7 : 1
                        }}
                    >
                        {saving ? t('common.loading') : t('settings.savePreferences', 'Enregistrer les préférences')}
                    </button>
                </div>
            )}

            {/* Public API Tokens Tab */}
            {activeTab === 'integrations' && (
                <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <KeyRound size={20} />
                        API publique
                    </h2>
                    <p style={{ color: '#6b7280', marginBottom: '20px', fontSize: '14px' }}>
                        Cree des tokens revocables pour connecter des applications tierces a cette organisation. La cle complete n'est affichee qu'une seule fois.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                        <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
                            <div style={{ fontWeight: 600, color: '#111827', marginBottom: '12px' }}>Nouveau token</div>
                            <label style={{ display: 'block', color: '#374151', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Nom</label>
                            <input value={apiKeyName} onChange={(e) => setApiKeyName(e.target.value)} placeholder="Dashboard atelier, script client, partenaire..." style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', marginBottom: '14px' }} />
                            <label style={{ display: 'block', color: '#374151', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Expiration optionnelle</label>
                            <input type="date" value={apiKeyExpiresAt} onChange={(e) => setApiKeyExpiresAt(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', marginBottom: '14px' }} />
                            <div style={{ color: '#374151', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Scopes</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', marginBottom: '16px' }}>
                                {apiKeyScopes.map(scope => (
                                    <label key={scope} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px', border: selectedApiScopes.includes(scope) ? '1px solid #6366f1' : '1px solid #e5e7eb', backgroundColor: selectedApiScopes.includes(scope) ? '#eef2ff' : '#fff', borderRadius: '8px', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={selectedApiScopes.includes(scope)} onChange={() => toggleApiScope(scope)} style={{ marginTop: '3px' }} />
                                        <span>
                                            <span style={{ display: 'block', fontFamily: 'monospace', fontSize: '12px', color: '#111827' }}>{scope}</span>
                                            <span style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>{scopeDescriptions[scope] || 'Permission API publique.'}</span>
                                        </span>
                                    </label>
                                ))}
                            </div>
                            <button onClick={createApiKey} disabled={!isAdminOrOwner || selectedApiScopes.length === 0} style={{ padding: '10px 16px', backgroundColor: isAdminOrOwner && selectedApiScopes.length ? '#6366f1' : '#9ca3af', color: 'white', border: 'none', borderRadius: '6px', cursor: isAdminOrOwner && selectedApiScopes.length ? 'pointer' : 'not-allowed', fontWeight: 600 }}>
                                Generer un token public
                            </button>
                        </div>

                        <div style={{ border: '1px solid #dbeafe', backgroundColor: '#eff6ff', borderRadius: '8px', padding: '16px' }}>
                            <div style={{ fontWeight: 600, color: '#1e3a8a', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileCode2 size={18} />
                                Documentation publique
                            </div>
                            <p style={{ color: '#1e40af', fontSize: '13px', margin: '0 0 12px' }}>
                                La documentation expose uniquement les routes publiques utilisables par les applications tierces.
                            </p>
                            <a href={publicDocsUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', color: '#1d4ed8', fontWeight: 700, fontSize: '14px', marginBottom: '16px' }}>
                                Ouvrir Swagger public
                            </a>
                            <div style={{ fontWeight: 600, color: '#1e3a8a', marginBottom: '8px' }}>Exemple</div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <code style={{ flex: 1, padding: '10px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #bfdbfe', overflowX: 'auto', fontSize: '12px' }}>{publicApiExample}</code>
                                <button onClick={() => navigator.clipboard?.writeText(publicApiExample)} style={{ border: '1px solid #93c5fd', color: '#1d4ed8', backgroundColor: 'white', borderRadius: '6px', padding: '10px', cursor: 'pointer', display: 'inline-flex' }} title="Copier l'exemple">
                                    <Copy size={16} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {newApiKey && (
                        <div style={{ border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                            <div style={{ fontWeight: 600, color: '#166534', marginBottom: '8px' }}>Nouveau token cree</div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <code style={{ flex: 1, padding: '10px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #dcfce7', overflowX: 'auto' }}>{formatTokenPreview(newApiKey)}</code>
                                <button onClick={() => navigator.clipboard?.writeText(newApiKey)} style={{ border: '1px solid #16a34a', color: '#166534', backgroundColor: 'white', borderRadius: '6px', padding: '10px', cursor: 'pointer', display: 'inline-flex' }} title="Copier">
                                    <Copy size={16} />
                                </button>
                            </div>
                            <p style={{ color: '#166534', fontSize: '13px', margin: '8px 0 0' }}>Copie-le maintenant. Pour des raisons de securite, il ne sera plus affiche apres.</p>
                        </div>
                    )}

                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                        {apiKeys.map((key) => (
                            <div key={key.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 150px 120px', gap: '12px', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
                                <div>
                                    <div style={{ fontWeight: 600 }}>{key.name}</div>
                                    <div style={{ color: '#6b7280', fontSize: '13px', marginTop: '2px' }}>{key.prefix}...</div>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                                        {(key.scopes || [key.scope]).map(scope => <span key={scope} style={{ fontSize: '11px', fontFamily: 'monospace', color: '#4338ca', backgroundColor: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '999px', padding: '3px 7px' }}>{scope}</span>)}
                                    </div>
                                    <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '6px' }}>
                                        Creee le {new Date(key.createdAt).toLocaleDateString()} - Derniere utilisation {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'jamais'} - Expiration {key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : 'aucune'}
                                    </div>
                                </div>
                                <div style={{ color: key.revokedAt ? '#dc2626' : '#16a34a', fontSize: '13px', fontWeight: 600 }}>{key.revokedAt ? 'Revoque' : 'Actif'}</div>
                                <button onClick={() => key.revokedAt ? deleteApiKey(key.id) : revokeApiKey(key.id)} disabled={!isAdminOrOwner} style={{ padding: '8px 10px', border: '1px solid #fecaca', backgroundColor: 'white', color: '#dc2626', borderRadius: '6px', cursor: !isAdminOrOwner ? 'not-allowed' : 'pointer' }}>
                                    {key.revokedAt ? 'Supprimer' : 'Revoquer'}
                                </button>
                            </div>
                        ))}
                        {apiKeys.length === 0 && <div style={{ padding: '20px', color: '#6b7280', textAlign: 'center' }}>Aucun token API publique pour cette organisation.</div>}
                    </div>
                </div>
            )}

            {/* Integrations Tab */}
            {false && activeTab === 'integrations' && (
                <div style={{
                    backgroundColor: 'white',
                    padding: '24px',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                }}>
                    <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <KeyRound size={20} />
                        OrcaSlicer
                    </h2>
                    <p style={{ color: '#6b7280', marginBottom: '20px', fontSize: '14px' }}>
                        Crée une clé révocable pour connecter le script Orca à l'API SpoolyTracker. La clé complète n'est affichée qu'une seule fois.
                    </p>

                    <div style={{ border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                        <div style={{ fontWeight: 600, color: '#111827', marginBottom: '8px' }}>Commande OrcaSlicer</div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <code style={{ flex: 1, padding: '10px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #e5e7eb', overflowX: 'auto' }}>
                                {orcaCommand}
                            </code>
                            <button
                                onClick={() => navigator.clipboard?.writeText(orcaCommand)}
                                style={{ border: '1px solid #d1d5db', color: '#374151', backgroundColor: 'white', borderRadius: '6px', padding: '10px', cursor: 'pointer', display: 'inline-flex' }}
                                title="Copier la commande"
                            >
                                <Copy size={16} />
                            </button>
                        </div>
                        {!newApiKey && (
                            <p style={{ color: '#6b7280', fontSize: '13px', margin: '8px 0 0' }}>
                                Genere une cle pour remplacer automatiquement TA_CLE_API dans la commande. Les anciennes cles completes ne peuvent pas etre reaffichees.
                            </p>
                        )}
                    </div>

                    {newApiKey && (
                        <div style={{ border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                            <div style={{ fontWeight: 600, color: '#166534', marginBottom: '8px' }}>Nouvelle clé créée</div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <code style={{ flex: 1, padding: '10px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #dcfce7', overflowX: 'auto' }}>
                                    {newApiKey}
                                </code>
                                <button
                                    onClick={() => navigator.clipboard?.writeText(newApiKey)}
                                    style={{ border: '1px solid #16a34a', color: '#166534', backgroundColor: 'white', borderRadius: '6px', padding: '10px', cursor: 'pointer', display: 'inline-flex' }}
                                    title="Copier"
                                >
                                    <Copy size={16} />
                                </button>
                            </div>
                            <p style={{ color: '#166534', fontSize: '13px', margin: '8px 0 0' }}>
                                Remplace C:\path\to\spooly_orca.py par l'emplacement réel du script sur la machine.
                            </p>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                        <input
                            value={apiKeyName}
                            onChange={(e) => setApiKeyName(e.target.value)}
                            placeholder="Nom de la clé"
                            style={{ minWidth: '240px', flex: 1, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                        />
                        <button
                            onClick={createApiKey}
                            disabled={!isAdminOrOwner}
                            style={{
                                padding: '10px 16px',
                                backgroundColor: isAdminOrOwner ? '#6366f1' : '#9ca3af',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: isAdminOrOwner ? 'pointer' : 'not-allowed',
                                fontWeight: 600,
                            }}
                        >
                            Générer une clé
                        </button>
                    </div>

                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                        {apiKeys.map((key) => (
                            <div key={key.id} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 120px', gap: '12px', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
                                <div>
                                    <div style={{ fontWeight: 600 }}>{key.name}</div>
                                    <div style={{ color: '#6b7280', fontSize: '13px' }}>{key.prefix}...</div>
                                    {rememberedApiKeys[key.prefix] ? (
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                                            <code style={{ maxWidth: '100%', padding: '6px 8px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', overflowX: 'auto', fontSize: '12px' }}>
                                                {rememberedApiKeys[key.prefix]}
                                            </code>
                                            <button
                                                onClick={() => navigator.clipboard?.writeText(rememberedApiKeys[key.prefix])}
                                                style={{ border: '1px solid #d1d5db', backgroundColor: 'white', color: '#374151', borderRadius: '6px', padding: '6px', cursor: 'pointer', display: 'inline-flex', flexShrink: 0 }}
                                                title="Copier la cle"
                                            >
                                                <Copy size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ color: '#9ca3af', fontSize: '12px', marginTop: '4px' }}>
                                            Cle complete indisponible. Genere une nouvelle cle pour la copier.
                                        </div>
                                    )}
                                </div>
                                <div style={{ color: key.revokedAt ? '#dc2626' : '#16a34a', fontSize: '13px', fontWeight: 600 }}>
                                    {key.revokedAt ? 'Révoquée' : 'Active'}
                                </div>
                                <button
                                    onClick={() => key.revokedAt ? deleteApiKey(key.id) : revokeApiKey(key.id)}
                                    disabled={!isAdminOrOwner}
                                    style={{ padding: '8px 10px', border: '1px solid #fecaca', backgroundColor: 'white', color: '#dc2626', borderRadius: '6px', cursor: !isAdminOrOwner ? 'not-allowed' : 'pointer' }}
                                >
                                    {key.revokedAt ? 'Supprimer' : 'Révoquer'}
                                </button>
                            </div>
                        ))}
                        {apiKeys.length === 0 && (
                            <div style={{ padding: '20px', color: '#6b7280', textAlign: 'center' }}>
                                Aucune clé API pour cette organisation.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Downloads Tab */}
            {activeTab === 'downloads' && (
                <div style={{
                    backgroundColor: 'white',
                    padding: '24px',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                }}>
                    <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>
                        {t('settings.downloads.title')}
                    </h2>
                    <p style={{ color: '#6b7280', marginBottom: '24px' }}>
                        {t('settings.downloads.description')}
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                        {/* Printer Bridge Card */}
                        <div style={{
                            border: '1px solid #e5e7eb',
                            borderRadius: '12px',
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '40px', height: '40px', borderRadius: '8px',
                                    backgroundColor: '#e0e7ff', color: '#4f46e5',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <PrinterIcon size={24} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '16px', fontWeight: '600' }}>{t('settings.downloads.printerBridge')}</h3>
                                    <span style={{ fontSize: '12px', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>
                                        {t('settings.downloads.windows')}
                                    </span>
                                </div>
                            </div>
                            <p style={{ fontSize: '14px', color: '#6b7280', flex: 1 }}>
                                {t('settings.downloads.printerBridgeDesc')}
                            </p>
                            <a
                                href={`${BASE_URL}/uploads/clients/SpoolyPrinterBridge.zip`}
                                download
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    padding: '10px',
                                    backgroundColor: '#4f46e5',
                                    color: 'white',
                                    textDecoration: 'none',
                                    borderRadius: '6px',
                                    fontWeight: '500',
                                    transition: 'background-color 0.2s'
                                }}
                            >
                                <Download size={16} />
                                {t('settings.downloads.downloadExe')} (ZIP)
                            </a>
                        </div>

                        {/* OrcaSlicer Script Card */}
                        <div style={{
                            border: '1px solid #e5e7eb',
                            borderRadius: '12px',
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '40px', height: '40px', borderRadius: '8px',
                                    backgroundColor: '#ecfdf5', color: '#059669',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <FileCode2 size={24} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '16px', fontWeight: '600' }}>OrcaSlicer Script</h3>
                                    <span style={{ fontSize: '12px', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>
                                        Python
                                    </span>
                                </div>
                            </div>
                            <p style={{ fontSize: '14px', color: '#6b7280', flex: 1 }}>
                                Script post-processing pour analyser le G-code OrcaSlicer et envoyer la consommation vers SpoolyTracker avec une clé API.
                            </p>
                            <a
                                href="/downloads/spooly_orca.py"
                                download
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    padding: '10px',
                                    backgroundColor: '#059669',
                                    color: 'white',
                                    textDecoration: 'none',
                                    borderRadius: '6px',
                                    fontWeight: '500',
                                    transition: 'background-color 0.2s'
                                }}
                            >
                                <Download size={16} />
                                Télécharger le script
                            </a>
                        </div>

                        {/* NFC Bridge Card */}
                        <div style={{
                            border: '1px solid #e5e7eb',
                            borderRadius: '12px',
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '40px', height: '40px', borderRadius: '8px',
                                    backgroundColor: '#fae8ff', color: '#a21caf',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <Nfc size={24} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '16px', fontWeight: '600' }}>{t('settings.downloads.nfcBridge')}</h3>
                                    <span style={{ fontSize: '12px', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>
                                        {t('settings.downloads.windows')}
                                    </span>
                                </div>
                            </div>
                            <p style={{ fontSize: '14px', color: '#6b7280', flex: 1 }}>
                                {t('settings.downloads.nfcBridgeDesc')}
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <a
                                    href={`${BASE_URL}/uploads/clients/SpoolyNFC.zip`}
                                    download
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        padding: '10px',
                                        backgroundColor: '#a21caf',
                                        color: 'white',
                                        textDecoration: 'none',
                                        borderRadius: '6px',
                                        fontWeight: '500',
                                        transition: 'background-color 0.2s'
                                    }}
                                >
                                    <Download size={16} />
                                    {t('settings.downloads.downloadGui')} (ZIP)
                                </a>
                                <a
                                    href={`${BASE_URL}/uploads/clients/spoolynfc-console.zip`}
                                    download
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        padding: '10px',
                                        backgroundColor: 'white',
                                        color: '#a21caf',
                                        border: '1px solid #a21caf',
                                        textDecoration: 'none',
                                        borderRadius: '6px',
                                        fontWeight: '500',
                                        transition: 'background-color 0.2s'
                                    }}
                                >
                                    <Download size={16} />
                                    {t('settings.downloads.downloadConsole')} (ZIP)
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Delete Account Confirmation Modal */}
            {deleteAccountModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', zIndex: 9999,
                }}>
                    <div style={{
                        backgroundColor: 'white', borderRadius: '16px', padding: '32px',
                        maxWidth: '480px', width: '90%', boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '50%',
                                backgroundColor: '#fee2e2', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>
                                <Trash2 size={24} color="#dc2626" />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827' }}>
                                    {t('settings.deleteAccountTitle', 'Supprimer le compte')}
                                </h3>
                                <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                                    {t('settings.deleteAccountIrreversible', 'Cette action est irréversible')}
                                </p>
                            </div>
                        </div>

                        <div style={{
                            backgroundColor: '#fef2f2', border: '1px solid #fecaca',
                            borderRadius: '8px', padding: '12px', marginBottom: '20px',
                        }}>
                            <p style={{ margin: 0, fontSize: '14px', color: '#991b1b', lineHeight: '1.5' }}>
                                {t('settings.deleteAccountWarning', 'Toutes vos données personnelles, connexions sociales et préférences seront définitivement effacées. Vous serez retiré de toutes vos organisations.')}
                            </p>
                        </div>

                        <p style={{ fontSize: '14px', color: '#374151', marginBottom: '8px' }}>
                            {t('settings.deleteAccountTypeWord', 'Pour confirmer, tapez le mot suivant :')}
                        </p>
                        <div style={{
                            backgroundColor: '#f3f4f6', padding: '8px 16px',
                            borderRadius: '6px', textAlign: 'center', marginBottom: '12px',
                            fontFamily: 'monospace', fontSize: '20px', fontWeight: '700',
                            color: '#dc2626', letterSpacing: '4px', userSelect: 'none',
                        }}>
                            {deleteConfirmWord}
                        </div>
                        <input
                            type="text"
                            value={deleteConfirmInput}
                            onChange={(e) => setDeleteConfirmInput(e.target.value.toUpperCase())}
                            placeholder={t('settings.deleteAccountPlaceholder', 'Tapez le mot ci-dessus...')}
                            autoFocus
                            style={{
                                width: '100%', padding: '10px 12px',
                                border: deleteConfirmInput === deleteConfirmWord ? '2px solid #dc2626' : '1px solid #d1d5db',
                                borderRadius: '6px', fontSize: '16px',
                                textAlign: 'center', letterSpacing: '2px',
                                outline: 'none', marginBottom: '20px',
                                boxSizing: 'border-box',
                            }}
                        />

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => { setDeleteAccountModal(false); setDeleteConfirmInput(''); }}
                                disabled={deletingAccount}
                                style={{
                                    padding: '10px 20px', backgroundColor: 'white',
                                    border: '1px solid #d1d5db', borderRadius: '6px',
                                    cursor: 'pointer', fontWeight: '500', color: '#374151',
                                }}
                            >
                                {t('common.cancel', 'Annuler')}
                            </button>
                            <button
                                disabled={deleteConfirmInput !== deleteConfirmWord || deletingAccount}
                                onClick={async () => {
                                    setDeletingAccount(true);
                                    try {
                                        await api.deleteAccount();
                                        localStorage.clear();
                                        window.location.href = '/login';
                                    } catch (err: any) {
                                        alert(err?.message || t('settings.deleteAccountFailed', 'Impossible de supprimer le compte.'));
                                        setDeletingAccount(false);
                                    }
                                }}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: deleteConfirmInput === deleteConfirmWord ? '#dc2626' : '#fca5a5',
                                    color: 'white', border: 'none', borderRadius: '6px',
                                    cursor: deleteConfirmInput === deleteConfirmWord && !deletingAccount ? 'pointer' : 'not-allowed',
                                    fontWeight: '600', opacity: deletingAccount ? 0.7 : 1,
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                }}
                            >
                                <Trash2 size={16} />
                                {deletingAccount ? t('common.loading', 'Chargement...') : t('settings.deleteAccountConfirmBtn', 'Supprimer définitivement')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Box>
    );
}

