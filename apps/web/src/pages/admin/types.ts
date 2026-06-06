export interface Organization {
    id: number;
    name: string;
    slug: string;
    plan: 'free' | 'pro' | 'enterprise' | 'beta';
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    createdAt: string;
    usersCount?: number;
    userCount?: number;
}

export interface User {
    id: number;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    isSuperAdmin: boolean;
    systemRole: 'super_admin' | 'admin' | 'moderator' | 'user';
    isActive: boolean;
    isEmailVerified: boolean;
    introSeen?: boolean;
    createdAt: string;
    lastLoginAt?: string;
    googleId?: string | null;
    appleId?: string | null;
    userOrganizations?: { organization: { id: number, name: string, slug: string } }[];
    pushTokens?: { id: number, deviceName?: string, lastSeenAt: string }[];
    organizationId?: number;
}

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
    organizationId: number;
    organization?: {
        name: string;
    };
    createdAt: string;
}

export interface AuditLog {
    id: number;
    action: string;
    performedById: number;
    performedByUsername: string;
    targetType: string | null;
    targetId: number | null;
    targetLabel: string | null;
    reason: string | null;
    metadata: Record<string, any> | null;
    ipAddress: string | null;
    createdAt: string;
}

export interface AuditLogStats {
    today: number;
    thisWeek: number;
    thisMonth: number;
    total: number;
    topActions: { action: string; count: number }[];
    topAdmins: { username: string; count: number }[];
}
