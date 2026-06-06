import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api, BASE_URL } from '../api';
import type { UserOrganization } from '../api';
import { useTranslation } from 'react-i18next';

export function OrganizationSwitcher() {
    const { token } = useAuth();
    const { t } = useTranslation();
    const [userOrgs, setUserOrgs] = useState<UserOrganization[]>([]);
    const [currentOrgId, setCurrentOrgId] = useState<number>(1);
    const [showDropdown, setShowDropdown] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newOrgName, setNewOrgName] = useState('');

    useEffect(() => {
        fetchOrganizations();
        const storedOrgId = localStorage.getItem('organization_id');
        if (storedOrgId) {
            setCurrentOrgId(parseInt(storedOrgId, 10));
        }
    }, []);

    const fetchOrganizations = async () => {
        try {
            const data = await api.getOrganizations();
            setUserOrgs(data);
        } catch (error) {
            console.error('Failed to fetch organizations:', error);
        }
    };

    const switchOrganization = async (orgId: number) => {
        setCurrentOrgId(orgId);
        localStorage.setItem('organization_id', orgId.toString());
        setShowDropdown(false);
        try {
            await api.setActiveOrganization(orgId);
        } catch (error) {
            console.error('Failed to persist active organization:', error);
        }
        window.location.reload(); // Reload to fetch new org data
    };

    const handleAccept = async (e: React.MouseEvent, orgId: number) => {
        e.stopPropagation();
        try {
            await api.acceptInvitation(orgId);
            fetchOrganizations();
        } catch (error) {
            console.error('Failed to accept:', error);
        }
    };

    const handleDecline = async (e: React.MouseEvent, orgId: number) => {
        e.stopPropagation();
        if (!confirm(t('common.confirmDecline'))) return;
        try {
            await api.declineInvitation(orgId);
            fetchOrganizations();
        } catch (error) {
            console.error('Failed to decline:', error);
        }
    };

    const createOrganization = async () => {
        if (!newOrgName.trim()) return;

        try {
            const response = await fetch(`${BASE_URL}/organizations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ name: newOrgName }),
            });

            if (response.ok) {
                // Refresh list
                fetchOrganizations();
                setShowCreateModal(false);
                setNewOrgName('');
            }
        } catch (error) {
            console.error('Failed to create organization:', error);
        }
    };

    const currentOrgEntry = userOrgs.find(uo => uo.organization.id === currentOrgId);
    const currentOrgName = currentOrgEntry ? currentOrgEntry.organization.name : t('common.selectOrg', 'Select Organization');

    return (
        <div style={{ position: 'relative' }}>
            {/* Organization Selector Button */}
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    backgroundColor: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                }}
            >
                <span>🏢</span>
                <span>{currentOrgName}</span>
                <span style={{ fontSize: '12px' }}>▼</span>
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    backgroundColor: 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    minWidth: '300px',
                    zIndex: 1000,
                    maxHeight: '400px',
                    overflowY: 'auto'
                }}>
                    <div style={{ padding: '8px 0' }}>
                        {userOrgs.map(uo => (
                            <div
                                key={uo.id}
                                style={{
                                    padding: '10px 16px',
                                    borderBottom: '1px solid #f3f4f6',
                                    background: uo.organization.id === currentOrgId ? '#f3f4f6' : 'white',
                                }}
                            >
                                <div
                                    onClick={() => uo.hasConfirmed && switchOrganization(uo.organization.id)}
                                    style={{
                                        cursor: uo.hasConfirmed ? 'pointer' : 'default',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        opacity: uo.hasConfirmed ? 1 : 0.7
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: '500' }}>{uo.organization.name}</div>
                                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                            {uo.organization.plan?.toUpperCase()} • {uo.role.toUpperCase()}
                                        </div>
                                        {(uo.organization.manualPlanEndDate || uo.organization.stripeSubscriptionEndDate || uo.organization.trialEndsAt) && (
                                            <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px', fontStyle: 'italic' }}>
                                                {t('admin.manualPlanEndDate')}: {new Date(uo.organization.manualPlanEndDate || uo.organization.stripeSubscriptionEndDate || uo.organization.trialEndsAt!).toLocaleDateString()}
                                            </div>
                                        )}
                                    </div>
                                    {uo.hasConfirmed && uo.organization.id === currentOrgId && <span>✓</span>}
                                </div>

                                {!uo.hasConfirmed && (
                                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={(e) => handleAccept(e, uo.organization.id)}
                                            style={{
                                                fontSize: '12px', padding: '4px 8px', borderRadius: '4px',
                                                border: 'none', background: '#22c55e', color: 'white', cursor: 'pointer'
                                            }}
                                        >
                                            {t('common.accept', 'Accept')}
                                        </button>
                                        <button
                                            onClick={(e) => handleDecline(e, uo.organization.id)}
                                            style={{
                                                fontSize: '12px', padding: '4px 8px', borderRadius: '4px',
                                                border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer'
                                            }}
                                        >
                                            {t('common.decline', 'Decline')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div style={{ borderTop: '1px solid #e5e7eb', padding: '8px' }}>
                        <button
                            onClick={() => {
                                setShowDropdown(false);
                                setShowCreateModal(true);
                            }}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                backgroundColor: '#6366f1',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '500',
                            }}
                        >
                            + {t('common.createOrg', 'Create New Organization')}
                        </button>
                    </div>
                </div>
            )}

            {/* Create Organization Modal */}
            {showCreateModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000,
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '24px',
                        borderRadius: '12px',
                        maxWidth: '400px',
                        width: '90%',
                    }}>
                        <h2 style={{ marginTop: 0 }}>{t('common.createOrg', 'Create New Organization')}</h2>
                        <input
                            type="text"
                            value={newOrgName}
                            onChange={(e) => setNewOrgName(e.target.value)}
                            placeholder={t('settings.placeholders.organization', 'Organization name')}
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                marginBottom: '16px',
                                fontSize: '14px',
                            }}
                            onKeyPress={(e) => e.key === 'Enter' && createOrganization()}
                        />
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setNewOrgName('');
                                }}
                                style={{
                                    padding: '8px 16px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    backgroundColor: 'white',
                                    cursor: 'pointer',
                                }}
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                onClick={createOrganization}
                                style={{
                                    padding: '8px 16px',
                                    border: 'none',
                                    borderRadius: '6px',
                                    backgroundColor: '#6366f1',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontWeight: '500',
                                }}
                            >
                                {t('common.create', 'Create')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

