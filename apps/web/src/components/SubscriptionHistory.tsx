import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BASE_URL } from '../api';
import { useAuth } from '../contexts/AuthContext';

export interface Subscription {
    id: number;
    stripeSubscriptionId: string;
    stripeCustomerId: string;
    status: string;
    planId: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    canceledAt: string | null;
}

interface Props {
    organizationId: string;
    refreshTrigger?: number;
}

export function SubscriptionHistory({ organizationId, refreshTrigger }: Props) {
    const { token } = useAuth();
    const { t } = useTranslation();
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSubscriptions = async () => {
            try {
                const res = await fetch(`${BASE_URL}/stripe/organizations/${organizationId}/subscriptions`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (res.ok) {
                    const data = await res.json();
                    setSubscriptions(data);
                }
            } catch (err) {
                console.error("Failed to fetch subscriptions", err);
            } finally {
                setLoading(false);
            }
        };

        if (organizationId) {
            fetchSubscriptions();
        }
    }, [organizationId, token, refreshTrigger]);

    if (loading) {
        return <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>{t('common.loading', 'Loading...')}</div>;
    }

    if (subscriptions.length === 0) {
        return (
            <div style={{ marginTop: '32px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#111827' }}>
                    {t('settings.subscriptionHistory', 'Historique des abonnements')}
                </h3>
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    padding: '32px',
                    textAlign: 'center',
                    color: '#6b7280'
                }}>
                    {t('settings.noSubscriptions', "Aucun historique d'abonnement disponible.")}
                </div>
            </div>
        );
    }

    const getStatusBadge = (status: string, cancelAtPeriodEnd: boolean) => {
        let bgColor = '#f3f4f6';
        let color = '#374151';
        let label = status;

        if (status === 'active') {
            bgColor = cancelAtPeriodEnd ? '#fef3c7' : '#dcfce3';
            color = cancelAtPeriodEnd ? '#92400e' : '#166534';
            label = cancelAtPeriodEnd ? t('settings.statusCanceling', 'Canceling') : t('settings.statusActive', 'Active');
        } else if (status === 'canceled') {
            bgColor = '#fee2e2';
            color = '#991b1b';
            label = t('settings.statusCanceled', 'Canceled');
        } else if (status === 'past_due') {
            bgColor = '#fef08a';
            color = '#854d0e';
            label = t('settings.statusPastDue', 'Past Due');
        }

        return (
            <span style={{
                padding: '4px 10px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: '600',
                backgroundColor: bgColor,
                color: color,
                textTransform: 'capitalize'
            }}>
                {label}
            </span>
        );
    };

    const getPlanName = (planId: string) => {
        if (!planId) return 'N/A';
        // A simple heuristic for display since price IDs can change between test/live
        if (planId.includes('1T9XX5')) return 'Pro';
        if (planId.includes('1T9XXI')) return 'Enterprise';
        return t('settings.paidPlan', 'Paid Plan');
    };

    return (
        <div style={{ marginTop: '32px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#111827' }}>
                {t('settings.subscriptionHistory', 'Historique des abonnements')}
            </h3>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                overflow: 'hidden',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                            <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#4b5563' }}>{t('settings.plan', 'Plan')}</th>
                            <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#4b5563' }}>{t('settings.status', 'Status')}</th>
                            <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#4b5563' }}>{t('settings.periodStart', 'Début')}</th>
                            <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#4b5563' }}>{t('settings.periodEnd', 'Fin')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {subscriptions.map(sub => (
                            <tr key={sub.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111827' }}>
                                    {getPlanName(sub.planId)} <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '6px' }}>{sub.stripeSubscriptionId.substring(0, 10)}...</span>
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                                    {getStatusBadge(sub.status, sub.cancelAtPeriodEnd)}
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: '14px', color: '#4b5563' }}>
                                    {new Date(sub.currentPeriodStart).toLocaleDateString()}
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: '14px', color: '#4b5563' }}>
                                    {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
