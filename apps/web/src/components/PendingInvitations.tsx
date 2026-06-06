import { useState, useEffect } from 'react';
import { api } from '../api';
import type { UserOrganization } from '../api';
import { Check, X, Building } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function PendingInvitations() {
    const [invitations, setInvitations] = useState<UserOrganization[]>([]);
    const { t } = useTranslation();

    const fetchInvitations = async () => {
        try {
            const orgs = await api.getOrganizations();
            setInvitations(orgs.filter(uo => !uo.hasConfirmed));
        } catch (error) {
            console.error('Failed to fetch invitations', error);
        }
    };

    useEffect(() => {
        fetchInvitations();
    }, []);

    const handleAccept = async (orgId: number) => {
        try {
            await api.acceptInvitation(orgId);
            fetchInvitations();
            // Optional: trigger a refresh of the main app or redirect
            window.location.reload();
        } catch (error) {
            console.error('Failed to accept invitation', error);
            alert('Failed to accept invitation');
        }
    };

    const handleDecline = async (orgId: number) => {
        if (!confirm(t('common.confirmDecline', 'Are you sure you want to decline this invitation?'))) return;
        try {
            await api.declineInvitation(orgId);
            fetchInvitations();
        } catch (error) {
            console.error('Failed to decline invitation', error);
            alert('Failed to decline invitation');
        }
    };

    if (invitations.length === 0) return null;

    return (
        <div style={{
            marginBottom: '24px',
            padding: '16px',
            backgroundColor: '#eff6ff', // Light blue
            border: '1px solid #bfdbfe',
            borderRadius: '12px',
        }}>
            <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#1e40af',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            }}>
                <Building size={20} />
                {t('settings.pendingInvitations', 'Pending Invitations')}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {invitations.map(invitation => (
                    <div key={invitation.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        border: '1px solid #dbeafe'
                    }}>
                        <div>
                            <div style={{ fontWeight: '600', color: '#1e3a8a' }}>
                                {invitation.organization.name}
                            </div>
                            <div style={{ fontSize: '14px', color: '#64748b' }}>
                                {t('settings.invitedAs', 'Invited as')} {invitation.role}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => handleAccept(invitation.organization.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '8px 12px',
                                    backgroundColor: '#22c55e',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: '500'
                                }}
                            >
                                <Check size={16} />
                                {t('common.accept', 'Accept')}
                            </button>
                            <button
                                onClick={() => handleDecline(invitation.organization.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '8px 12px',
                                    backgroundColor: 'white',
                                    color: '#ef4444',
                                    border: '1px solid #ef4444',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: '500'
                                }}
                            >
                                <X size={16} />
                                {t('common.decline', 'Decline')}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
