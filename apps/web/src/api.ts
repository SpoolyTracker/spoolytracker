import type { AnalyticsOverview } from './types/analytics';
import { getEnv } from './runtimeEnv';

export interface Brand {
    id: number;
    name: string;
    isCustom: boolean;
    logoUrl?: string;
}

export interface FilamentMaterial {
    id: number;
    name: string;
    description: string;
}

export interface FilamentType {
    id: number;
    name: string;
    description: string;
}

export type StorageUnitKind = 'shelf' | 'cabinet' | 'display' | 'bin';

export interface StorageUnit {
    id: number;
    name: string;
    location?: string | null;
    kind: StorageUnitKind;
    levels: number;
    slotsPerLevel: number;
    tagId?: string | null;
    favorite?: boolean;
    organizationId?: number | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface BrandCatalogEntry {
    id: number;
    brandId: number;
    materialId: number;
    typeId: number;
    brand: Brand;
    material: FilamentMaterial;
    type: FilamentType;
    organizationId?: number | null;
    // SpoolmanDB data
    density_gcm3?: number;
    nozzle_temp_min?: number;
    nozzle_temp_max?: number;
    bed_temp_min?: number;
    bed_temp_max?: number;
    isActive?: boolean;
}

export interface FilamentColorReference {
    id: number;
    brandId: number;
    materialId?: number | null;
    typeId?: number | null;
    brand?: Brand;
    material?: FilamentMaterial | null;
    type?: FilamentType | null;
    organizationId?: number | null;
    organization?: Organization | null;
    name: string;
    primaryHex: string;
    hexes?: string[] | null;
    source: 'manual' | 'spoolman';
    sourceExternalId?: string | null;
    finish?: string | null;
    pattern?: string | null;
    multiColorDirection?: string | null;
    translucent?: boolean | null;
    glow?: boolean | null;
    isActive?: boolean;
}
export const FilamentOptionCategory = {
    FINISH: 'finish',
    PROPERTY: 'property',
    FEATURE: 'feature',
    TEXTURE: 'texture',
    SPECIAL: 'special'
} as const;

export type FilamentOptionCategory = typeof FilamentOptionCategory[keyof typeof FilamentOptionCategory];

export interface FilamentOption {
    id: number;
    name: string;
    category: string;
    description: string;
    isCharacteristic: boolean;
    organizationId?: number | null;
}

export interface Organization {
    id: number;
    name: string;
    slug: string;
    plan: 'free' | 'pro' | 'enterprise' | 'beta';
    manualPlanEndDate?: string | null;
    stripeSubscriptionEndDate?: string | null;
    trialEndsAt?: string | null;
    stats?: {
        spoolsCount: number;
        activeSpoolsCount: number;
        lockedSpoolsCount: number;
        depletedSpoolsCount: number;
        membersCount: number;
        projectsCount: number;
        limits: {
            maxSpoolsPerOrg: number;
            maxMembersPerOrg: number;
            maxProjectsPerOrg: number;
            maxFileUploadSizeMb: number;
        }
    };
}

export interface UserOrganization {
    id: number;
    userId: number;
    organizationId: number;
    role: 'owner' | 'admin' | 'member';
    hasConfirmed: boolean;
    organization: Organization;
}

export interface ConsumptionLog {
    id: number;
    filamentId: number;
    amount: number;
    type: 'MANUAL' | 'PRINT' | 'FAIL';
    notes?: string;
    date: string;
    filament?: Filament;
    project?: Project;
    projectId?: number;
    is_planned?: boolean;
}

export interface Filament {
    id: number;
    brandId: number;
    materialId: number;
    brand?: Brand;
    material?: FilamentMaterial;
    type?: FilamentType;
    types?: FilamentType[];
    options?: FilamentOption[];
    color: string;
    colorName?: string;
    colors?: string[];
    colorReferenceId?: number | null;
    weightInitial: number;
    weightRemaining: number;
    nfcTagId: string | null;
    organization?: {
        id: number;
        name: string;
        slug: string;
    };
    // Inventory
    purchaseDate?: string;
    price?: number;
    vendor?: string;
    isRefill: boolean;
    favorite?: boolean;
    spoolReference?: string;
    storageUnitId?: number | null;
    storageUnit?: StorageUnit | null;
    storageLevel?: number | null;
    storageSlot?: number | null;
    // Tech Specs
    nozzleTempMin?: number;
    nozzleTempMax?: number;
    bedTempMin?: number;
    bedTempMax?: number;
    bedTemp?: number;
    chamberTempMin?: number;
    chamberTempMax?: number;
    dryTemp?: number;
    dryTime?: number;
    printSpeedMin?: number;
    printSpeedMax?: number;
    retractionDistanceMm?: number;
    retractionSpeedMmS?: number;
    retractionZHopMm?: number;
    retractionNotes?: string;
    conditionalTemperatureRules?: ConditionalTemperatureRule[];
    kFactor?: number;
    maxVolumetricSpeedMm3S?: number;
    flowRatio?: number;
    densityGcm3?: number;
    diameterMm?: number;
    lowStockThreshold?: number;
    lowStockThresholdType?: 'GRAMS' | 'PERCENTAGE';
    isLocked?: boolean;
    plannedWeight?: number;
    virtualWeightRemaining?: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface ConditionalTemperatureRule {
    speedMinMmS?: number | null;
    speedMaxMmS?: number | null;
    nozzleTempMin?: number | null;
    nozzleTempMax?: number | null;
    notes?: string | null;
}

export interface ProjectItem {
    id: number;
    projectId: number;
    filamentId?: number;
    filament?: Filament;
    material?: string;
    color?: string;
    weight_required_g: number;
    weight_used_g: number;
}

export interface ProjectOverheadRate {
    label: string;
    percentage: number;
}

export interface ProjectExternalItem {
    id: number;
    projectId: number;
    title: string;
    external_ref?: string | null;
    source?: string | null;
    url?: string | null;
    unit_price: number;
    quantity: number;
    created_at?: string;
    updated_at?: string;
}

export interface ProjectFile {
    id: number;
    projectId: number;
    file_url: string | null;
    file_type: 'GCODE' | 'IMAGE' | 'MODEL' | 'OTHER';
    file_name: string;
    file_size?: number;
    uploaded_at: string;
    analysis_metadata?: any;
}

export interface GCodeAnalysisResult {
    print_time_seconds?: number;
    filament_used_g?: number;
    filament_used_m?: number;
    volumes?: Record<string, { volumeMm3: number }>;
}

export const ProjectStatus = {
    PLANNING: 'PLANNING',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    ARCHIVED: 'ARCHIVED',
} as const;

export type ProjectStatus = typeof ProjectStatus[keyof typeof ProjectStatus];

export interface Project {
    id: number;
    name: string;
    description?: string;
    status: ProjectStatus;
    global_cost?: number;
    start_date?: string | null;
    end_date?: string | null;
    image_url?: string;
    misc_costs?: number;
    printer_power_kw?: number;
    electricity_cost_kwh?: number;
    target_selling_price?: number;
    notes?: string;
    tags?: string[];
    items?: ProjectItem[];
    externalItems?: ProjectExternalItem[];
    overhead_rates?: ProjectOverheadRate[];
    files: ProjectFile[];
    consumptionLogs: ConsumptionLog[];
    created_at: string;
    updated_at: string;
    print_time_seconds?: number;
    labor_time_seconds?: number;
    machine_hourly_rate?: number;
    labor_hourly_rate?: number;
}

export interface AiClientContext {
    mode?: 'auto' | 'calibration' | 'stock' | 'project';
    source?: 'passive' | 'active' | 'mixed';
    filamentIds?: number[];
    projectId?: number | null;
    page?: {
        path: string;
        kind?: string;
    };
}

export const BASE_URL = getEnv('VITE_API_URL', 'http://localhost:3000');
export const AI_ENGINE_URL = getEnv('VITE_AI_ENGINE_URL', 'http://localhost:8000');
const API_URL = `${BASE_URL}/filaments`;
const AUTH_URL = `${BASE_URL}/auth`;
const REF_URL = `${BASE_URL}/reference-data`;

let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
    authToken = token;
};

const getHeaders = (organizationIdOverride?: string | null) => {
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    // Logic: 
    // 1. If override is explicitly null, DO NOT set header (Global)
    // 2. If override is string, use it
    // 3. Optional: If override is undefined, fall back to stored/emulated

    if (organizationIdOverride === null) {
        // Explicitly global - send no org header
        return headers;
    }

    const effectiveOrgId = organizationIdOverride || localStorage.getItem('emulated_organization_id') || localStorage.getItem('organization_id');

    if (effectiveOrgId) {
        headers['x-organization-id'] = effectiveOrgId;
    }
    return headers;
};

const getOrganizationId = (): string | null => {
    return localStorage.getItem('emulated_organization_id') || localStorage.getItem('organization_id');
};

let isRedirectingToLogin = false;

const clearStoredAuth = () => {
    authToken = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('organization_id');
    localStorage.removeItem('emulated_organization_id');
};

const getRequestUrl = (input?: RequestInfo | URL): string => {
    if (!input) return '';
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.toString();
    return input.url;
};

const isPublicAuthRequest = (url: string) => (
    url.startsWith(`${AUTH_URL}/login`) ||
    url.startsWith(`${AUTH_URL}/signup`) ||
    url.startsWith(`${AUTH_URL}/social-login`) ||
    url.startsWith(`${AUTH_URL}/forgot-password`) ||
    url.startsWith(`${AUTH_URL}/reset-password`) ||
    url.startsWith(`${AUTH_URL}/verify-email`) ||
    url.startsWith(`${AUTH_URL}/session`)
);

const handleUnauthorized = (input?: RequestInfo | URL) => {
    const requestUrl = getRequestUrl(input);
    const hasStoredSession = Boolean(authToken || localStorage.getItem('auth_token') || localStorage.getItem('auth_user'));

    if (!hasStoredSession || isPublicAuthRequest(requestUrl) || isRedirectingToLogin || window.location.pathname === '/login') {
        return;
    }

    isRedirectingToLogin = true;
    clearStoredAuth();

    const currentPath = `${window.location.pathname}${window.location.search}`;
    const redirectParam = currentPath && currentPath !== '/login' ? `?redirect=${encodeURIComponent(currentPath)}` : '';
    window.location.assign(`/login${redirectParam}`);
};

const authAwareFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await fetch(input, init);
    if (response.status === 401) {
        handleUnauthorized(input);
    }
    return response;
};

const handleResponse = async (response: Response, request?: RequestInfo | URL) => {
    if (response.status === 401) {
        handleUnauthorized(request);
    }

    const responseText = await response.text().catch(() => '');
    const parsePayload = () => {
        if (!responseText) return {};
        try {
            return JSON.parse(responseText);
        } catch {
            return { message: responseText };
        }
    };

    if (!response.ok) {
        const error = parsePayload();
        const err = new Error(error.message || 'API Error');
        (err as any).errorCode = error.errorCode;
        (err as any).status = response.status;
        throw err;
    }
    if (!responseText) return undefined;
    return parsePayload();
};

/**
 * Shared fetch helper to ensure credentials (cookies) are sent,
 * and 401 errors trigger a login redirect.
 */
const apiFetch = async (url: string, options: RequestInit = {}) => {
    const res = await authAwareFetch(url, {
        ...options,
        credentials: 'include', // CRITICAL: Allows shared cookies
        headers: {
            ...getHeaders(options.headers instanceof Headers ? options.headers.get('x-organization-id') : (options.headers as any)?.['x-organization-id']),
            ...options.headers,
        }
    });
    return handleResponse(res, url);
};

// Notification types
export const NotificationType = {
    SYSTEM: 'SYSTEM',
    NEW_SPOOL: 'NEW_SPOOL',
    CONSUMPTION: 'CONSUMPTION',
    LOW_STOCK: 'LOW_STOCK',
    INVITATION: 'INVITATION',
    AI_ALERT: 'AI_ALERT',
} as const;

export type NotificationType = typeof NotificationType[keyof typeof NotificationType];

export interface Notification {
    id: number;
    userId: number;
    type: NotificationType;
    title: string;
    message: string;
    data: any;
    isRead: boolean;
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

export interface ApiKeySummary {
    id: number;
    name: string;
    prefix: string;
    scope: string;
    scopes: string[];
    organizationId: number;
    expiresAt?: string | null;
    createdAt: string;
    lastUsedAt?: string | null;
    revokedAt?: string | null;
}

export interface CreateApiKeyInput {
    name: string;
    scopes: string[];
    expiresAt?: string | null;
}

export interface SpoolmanAnalysisResult {
    missingBrands: string[];
    missingMaterials: string[];
    missingCombinations: Array<{
        brandId: number;
        brandName: string;
        materialId: number;
        materialName: string;
    }>;
    conflicts: Array<{
        id: number;
        brandName: string;
        materialName: string;
        current: {
            density: number;
            nozzle_min: number;
            nozzle_max: number;
            bed_min: number;
            bed_max: number;
        };
        new: {
            density?: number;
            nozzle_min?: number;
            nozzle_max?: number;
            bed_min?: number;
            bed_max?: number;
        };
    }>;
}

export const SpoolmanAPI = {
    async analyze(): Promise<SpoolmanAnalysisResult> {
        return apiFetch(`${API_URL}/admin/catalog/analyze-spoolman`, {
            method: 'POST',
        });
    },

    async import(
        brands: string[],
        materials: string[],
        importCombinations: boolean = false,
        updates: any[] = []
    ): Promise<any> {
        return apiFetch(`${API_URL}/admin/catalog/import-spoolman`, {
            method: 'POST',
            body: JSON.stringify({ brands, materials, importCombinations, updates })
        });
    }
};

export const api = {
    // ... existing methods

    syncSpoolman: async () => {
        return apiFetch(`${API_URL}/admin/catalog/sync-spoolman`, {
            method: 'POST',
        });
    },

    getSpoolmanSyncJob: async (id: string | number): Promise<{ id: string; status: string; progress: number; result?: any; error?: string }> => {
        return apiFetch(`${API_URL}/admin/catalog/sync-spoolman/job/${id}`);
    },

    analyzeSpoolman: async () => {
        return SpoolmanAPI.analyze();
    },

    importSpoolman: async (brands: string[], materials: string[], importCombinations: boolean = false, updates: any[] = []) => {
        return SpoolmanAPI.import(brands, materials, importCombinations, updates);
    },

    getProjectReport: async (id: number, lang: string = 'en'): Promise<Blob> => {
        const response = await authAwareFetch(`${BASE_URL}/projects/${id}/report?lang=${lang}`, {
            headers: getHeaders(),
            credentials: 'include',
        });
        if (response.status === 401) {
            handleResponse(response);
        }
        if (!response.ok) throw new Error('Failed to generate report');
        return response.blob();
    },

    async checkProjectFeasibility(projectId: number): Promise<{
        projectId: number;
        overallStatus: 'OK' | 'RISK' | 'CRITICAL' | 'RESTRICTED';
        items: Array<{
            itemId: number;
            name: string;
            formattedName: string;
            status: 'OK' | 'RISK' | 'CRITICAL';
            message: string;
            stockAvailable: number;
            remainingNeeded: number;
            potentialFilaments: string[];
        }>;
    }> {
        return apiFetch(`${BASE_URL}/projects/${projectId}/feasibility`);
    },

    async updateMemberRole(orgId: number, userId: number, role: 'admin' | 'member'): Promise<UserOrganization> {
        return apiFetch(`${BASE_URL}/organizations/${orgId}/members/${userId}/role`, {
            method: 'PUT',
            body: JSON.stringify({ role }),
        });
    },

    async setOrgAiAlertsPreference(orgId: number, enabled: boolean): Promise<{ organizationId: number; notifyOnAiAlerts: boolean }> {
        return apiFetch(`${BASE_URL}/organizations/${orgId}/ai-alerts-preference`, {
            method: 'POST',
            body: JSON.stringify({ enabled }),
        });
    },

    async forceUpdateMemberRole(orgId: number, userId: number, role: 'owner' | 'admin' | 'member', reason?: string): Promise<UserOrganization> {
        const res = await authAwareFetch(`${BASE_URL}/admin/organizations/${orgId}/members/${userId}/role`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ role, reason }),
        });
        if (!res.ok) throw new Error('Failed to force update member role');
        return res.json();
    },

    // Notifications
    getNotifications: async () => {
        return apiFetch(`${BASE_URL}/notifications`);
    },

    markNotificationRead: async (id: number) => {
        return apiFetch(`${BASE_URL}/notifications/${id}/read`, {
            method: 'PUT',
        });
    },

    markAllNotificationsRead: async () => {
        return apiFetch(`${BASE_URL}/notifications/read-all`, {
            method: 'PUT',
        });
    },

    createNotificationStream: () => {
        // SSE request with auth token in URL or standard if cookies are used.
        // EventSource doesn't natively support custom headers like Authorization.
        // For a simple implementation, if the token is required, it must be sent as a query param
        // since EventSource standard only supports GET with URLs.
        // However, we can use a polyfill or just let the browser handle it if we use cookies.
        // Assuming we pass token in URL for SSE:
        const url = new URL(`${BASE_URL}/notifications/stream`);
        if (authToken) {
            url.searchParams.append('token', authToken);
        }
        return new EventSource(url.toString());
    },

    // Invitations
    acceptInvitation: async (orgId: number) => {
        return apiFetch(`${BASE_URL}/organizations/${orgId}/invitation/accept`, {
            method: 'POST',
        });
    },

    declineInvitation: async (orgId: number) => {
        return apiFetch(`${BASE_URL}/organizations/${orgId}/invitation/decline`, {
            method: 'POST',
        });
    },

    startTrial: async (orgId: number) => {
        return apiFetch(`${BASE_URL}/organizations/${orgId}/start-trial`, {
            method: 'POST',
        });
    },

    deleteOrganization: async (id: number): Promise<void> => {
        return apiFetch(`${BASE_URL}/organizations/${id}`, {
            method: 'DELETE',
            // Note: getHeaders(String(id)) was used here for x-organization-id, 
            // apiFetch handles this via getHeaders called inside it.
            headers: { 'x-organization-id': String(id) }
        });
    },

    // Filament methods...
    // ... existing methods ...

    async signup(data: any): Promise<any> {
        return apiFetch(`${AUTH_URL}/signup`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    async verifyEmail(token: string, id?: string): Promise<any> {
        let url = `${AUTH_URL}/verify-email?token=${token}`;
        if (id) {
            url += `&id=${id}`;
        }
        const res = await authAwareFetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Verification failed');
        }
        return res.json();
    },

    async forgotPassword(email: string): Promise<any> {
        const res = await authAwareFetch(`${AUTH_URL}/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Request failed');
        }
        return res.json();
    },

    async resetPassword(token: string, password: string): Promise<any> {
        const res = await authAwareFetch(`${AUTH_URL}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, password }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Reset failed');
        }
        return res.json();
    },

    async login(username: string, password: string): Promise<{ access_token: string; activeOrganizationId?: number; user: { id: number; username: string; isSuperAdmin: boolean; activeOrganizationId?: number } }> {
        const data = await apiFetch(`${AUTH_URL}/login`, {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });
        setAuthToken(data.access_token);
        // Set active organization from server response
        if (data.activeOrganizationId) {
            localStorage.setItem('organization_id', data.activeOrganizationId.toString());
        }
        // Clear old emulation
        localStorage.removeItem('emulated_organization_id');
        return data;
    },

    async logout(): Promise<void> {
        await apiFetch(`${AUTH_URL}/logout`, {
            method: 'POST',
        });
    },

    async deleteAccount(): Promise<void> {
        await apiFetch(`${AUTH_URL}/account`, {
            method: 'DELETE',
        });
    },

    async setIntroSeen(): Promise<void> {
        const res = await authAwareFetch(`${AUTH_URL}/intro-seen`, {
            method: 'POST',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to set intro seen');
        return res.json();
    },

    async resetIntro(): Promise<void> {
        const res = await authAwareFetch(`${AUTH_URL}/reset-intro`, {
            method: 'POST',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to reset intro');
        return res.json();
    },

    async setActiveOrganization(organizationId: number): Promise<{ activeOrganizationId: number }> {
        const res = await authAwareFetch(`${AUTH_URL}/active-organization`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ organizationId }),
        });
        if (!res.ok) throw new Error('Failed to set active organization');
        return res.json();
    },

    async socialLogin(provider: 'google' | 'apple', token: string): Promise<any> {
        return apiFetch(`${AUTH_URL}/social-login`, {
            method: 'POST',
            body: JSON.stringify({ provider, token }),
        });
    },

    async linkSocial(provider: 'google' | 'apple', token: string): Promise<any> {
        return apiFetch(`${AUTH_URL}/link-social`, {
            method: 'POST',
            body: JSON.stringify({ provider, token }),
        });
    },

    async unlinkSocial(provider: 'google' | 'apple'): Promise<any> {
        return apiFetch(`${AUTH_URL}/unlink-social`, {
            method: 'POST',
            body: JSON.stringify({ provider }),
        });
    },

    async completeSocialSignup(username: string, organizationName: string): Promise<any> {
        return apiFetch(`${AUTH_URL}/complete-social-signup`, {
            method: 'POST',
            body: JSON.stringify({ username, organizationName }),
        });
    },

    async getProfile(): Promise<any> {
        return apiFetch(`${AUTH_URL}/profile`);
    },

    async getSession(): Promise<{ access_token: string; activeOrganizationId?: number; user: any }> {
        const data = await apiFetch(`${AUTH_URL}/session`);
        setAuthToken(data.access_token);
        if (data.activeOrganizationId) {
            localStorage.setItem('organization_id', data.activeOrganizationId.toString());
        }
        localStorage.removeItem('emulated_organization_id');
        return data;
    },

    async getAll(): Promise<Filament[]> {
        const orgId = getOrganizationId();
        const res = await authAwareFetch(`${API_URL}?organizationId=${orgId}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch filaments');
        return res.json();
    },

    async get(id: number): Promise<Filament> {
        const orgId = getOrganizationId();
        const res = await authAwareFetch(`${API_URL}/${id}?organizationId=${orgId}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch filament');
        return res.json();
    },

    async getFilamentByTag(tagId: string): Promise<Filament | null> {
        const orgId = getOrganizationId();
        try {
            return await apiFetch(`${API_URL}/by-tag/${tagId}?organizationId=${orgId}`);
        } catch (e) {
            if ((e as any).status === 404) return null;
            throw e;
        }
    },

    async enrichTigerTag(data: { brandId?: number; materialId?: number; typeId?: number }): Promise<any> {
        return apiFetch(`${BASE_URL}/tigertag/enrich`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async resolveTigerTag(data: { brandId?: number; materialId?: number; typeId?: number }): Promise<any> {
        return apiFetch(`${BASE_URL}/tigertag/resolve-raw`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async create(data: any): Promise<Filament> {
        const orgId = getOrganizationId();
        return apiFetch(`${API_URL}?organizationId=${orgId}`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    async bulkUpdate(ids: number[], data: any): Promise<{ successCount: number; failCount: number }> {
        const orgId = getOrganizationId();
        return apiFetch(`${API_URL}/bulk?organizationId=${orgId}`, {
            method: 'PUT',
            body: JSON.stringify({ ids, data }),
        });
    },

    async update(id: number, data: Partial<Filament> & any): Promise<Filament> {
        const orgId = getOrganizationId();
        return apiFetch(`${API_URL}/${id}?organizationId=${orgId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    async getConsumptionStats(): Promise<{ logs: any[], analytics: any, forecasts: any[] }> {
        const orgId = getOrganizationId();
        return apiFetch(`${API_URL}/consumption/stats?organizationId=${orgId}`);
    },

    async delete(id: number): Promise<void> {
        const orgId = getOrganizationId();
        await apiFetch(`${API_URL}/${id}?organizationId=${orgId}`, {
            method: 'DELETE',
        });
    },

    async logConsumption(id: number, amount: number, type: 'MANUAL' | 'PRINT' | 'FAIL' = 'MANUAL', notes?: string, date?: string, externalJobId?: string, isPlanned: boolean = false): Promise<ConsumptionLog> {
        const res = await authAwareFetch(`${API_URL}/${id}/consumption`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ amount, type, notes, date, externalJobId, isPlanned }),
        });
        if (!res.ok) throw new Error('Failed to log consumption');
        return res.json();
    },

    async consumeGroup(data: any): Promise<any> {
        const res = await authAwareFetch(`${API_URL}/consume-group`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to consume from group');
        return res.json();
    },

    async updateConsumption(id: number, data: any): Promise<void> {
        const orgId = getOrganizationId();
        const res = await authAwareFetch(`${API_URL}/consumption/${id}?organizationId=${orgId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to update consumption');
        return res.json();
    },

    async deleteConsumption(id: number): Promise<void> {
        const orgId = getOrganizationId();
        await apiFetch(`${API_URL}/consumption/${id}?organizationId=${orgId}`, {
            method: 'DELETE',
        });
    },

    async getOrganizations(): Promise<UserOrganization[]> {
        return apiFetch(`${BASE_URL}/organizations`);
    },

    // Reference Data APIs
    async getBrands(organizationId?: string | number): Promise<Brand[]> {
        const orgId = organizationId || getOrganizationId();
        const queryParams = [];
        if (orgId) queryParams.push(`organizationId=${orgId}`);

        const query = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
        const res = await authAwareFetch(`${REF_URL}/brands${query}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch brands');
        return res.json();
    },

    async createBrand(name: string, isGlobal = false, organizationId?: number): Promise<Brand> {
        const body: any = { name, isGlobal };
        if (!isGlobal) {
            body.organizationId = organizationId ?? Number(getOrganizationId());
        }
        const res = await authAwareFetch(`${REF_URL}/brands`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed to create brand');
        return res.json();
    },

    async updateBrand(id: number, name: string): Promise<Brand> {
        const res = await authAwareFetch(`${REF_URL}/brands/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ name }),
        });
        if (!res.ok) throw new Error('Failed to update brand');
        return res.json();
    },

    async deleteBrand(id: number): Promise<void> {
        const res = await authAwareFetch(`${REF_URL}/brands/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to delete brand');
    },

    async getMaterials(organizationId?: string | number): Promise<FilamentMaterial[]> {
        const orgId = organizationId || getOrganizationId();
        const queryParams = [];
        if (orgId) queryParams.push(`organizationId=${orgId}`);

        const query = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
        const res = await authAwareFetch(`${REF_URL}/materials${query}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch materials');
        return res.json();
    },

    async createMaterial(name: string, isGlobal = false, organizationId?: number): Promise<FilamentMaterial> {
        const body: any = { name, isGlobal };
        if (!isGlobal) {
            body.organizationId = organizationId ?? Number(getOrganizationId());
        }
        const res = await authAwareFetch(`${REF_URL}/materials`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed to create material');
        return res.json();
    },

    async updateMaterial(id: number, name: string): Promise<FilamentMaterial> {
        const res = await authAwareFetch(`${REF_URL}/materials/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ name }),
        });
        if (!res.ok) throw new Error('Failed to update material');
        return res.json();
    },

    async deleteMaterial(id: number): Promise<void> {
        const res = await authAwareFetch(`${REF_URL}/materials/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
            body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error('Failed to delete material');
    },

    async getTypes(organizationId?: string | number): Promise<FilamentType[]> {
        const orgId = organizationId || getOrganizationId();
        const queryParams = [];
        if (orgId) queryParams.push(`organizationId=${orgId}`);

        const query = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
        const res = await authAwareFetch(`${REF_URL}/types${query}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch types');
        return res.json();
    },

    async createType(name: string, isGlobal = false, organizationId?: number): Promise<FilamentType> {
        const body: any = { name, isGlobal };
        if (!isGlobal) {
            body.organizationId = organizationId ?? Number(getOrganizationId());
        }
        const res = await authAwareFetch(`${REF_URL}/types`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed to create type');
        return res.json();
    },

    async updateType(id: number, name: string): Promise<FilamentType> {
        const res = await authAwareFetch(`${REF_URL}/types/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ name }),
        });
        if (!res.ok) throw new Error('Failed to update type');
        return res.json();
    },

    async deleteType(id: number): Promise<void> {
        const res = await authAwareFetch(`${REF_URL}/types/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to delete type');
    },

    async getOptions(organizationId?: string | number): Promise<Record<string, FilamentOption[]>> {
        const orgId = organizationId || getOrganizationId();
        const queryParams = [];
        if (orgId) queryParams.push(`organizationId=${orgId}`);

        const query = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
        const res = await authAwareFetch(`${REF_URL}/options${query}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch options');
        return res.json();
    },

    async getOrgData(organizationId?: string | number): Promise<any> {
        const orgId = organizationId || getOrganizationId();
        const res = await authAwareFetch(`${BASE_URL}/organizations/${orgId}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch organization data');
        return res.json();
    },

    createOption: async (name: string, category: string, isCharacteristic: boolean = false, isGlobal: boolean = false) => {
        const body: any = { name, category, isCharacteristic, isGlobal };
        if (!isGlobal) {
            body.organizationId = Number(getOrganizationId());
        }
        const response = await authAwareFetch(`${API_URL}/options`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(body),
        });
        return handleResponse(response);
    },

    updateOption: async (id: number, name: string, category: string, isCharacteristic: boolean = false) => {
        const response = await authAwareFetch(`${API_URL}/options/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ name, category, isCharacteristic }),
        });
        return handleResponse(response);
    },

    async deleteOption(id: number): Promise<void> {
        const res = await authAwareFetch(`${REF_URL}/options/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to delete option');
    },

    async promoteBrand(id: number): Promise<Brand> {
        const res = await authAwareFetch(`${REF_URL}/brands/${id}/promote?admin=true`, {
            method: 'PUT',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to promote brand');
        return res.json();
    },

    async promoteMaterial(id: number): Promise<FilamentMaterial> {
        const res = await authAwareFetch(`${REF_URL}/materials/${id}/promote?admin=true`, {
            method: 'PUT',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to promote material');
        return res.json();
    },

    async promoteType(id: number): Promise<FilamentType> {
        const res = await authAwareFetch(`${REF_URL}/types/${id}/promote?admin=true`, {
            method: 'PUT',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to promote type');
        return res.json();
    },

    async promoteOption(id: number): Promise<FilamentOption> {
        const res = await authAwareFetch(`${REF_URL}/options/${id}/promote?admin=true`, {
            method: 'PUT',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to promote option');
        return res.json();
    },

    async getColorReferences(filters: {
        organizationId?: string | number;
        brandId?: string | number;
        materialId?: string | number;
        typeId?: string | number;
    } = {}): Promise<FilamentColorReference[]> {
        const orgId = filters.organizationId || getOrganizationId();
        const queryParams = [];
        if (orgId) queryParams.push(`organizationId=${orgId}`);
        if (filters.brandId) queryParams.push(`brandId=${filters.brandId}`);
        if (filters.materialId) queryParams.push(`materialId=${filters.materialId}`);
        if (filters.typeId) queryParams.push(`typeId=${filters.typeId}`);

        const query = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
        return apiFetch(`${REF_URL}/colors${query}`);
    },

    async createColorReference(data: Partial<FilamentColorReference> & {
        brandId: number;
        name: string;
        primaryHex: string;
        isGlobal?: boolean;
    }): Promise<FilamentColorReference> {
        const query = data.isGlobal ? '?admin=true' : '';
        const body: any = { ...data };
        if (!data.isGlobal) {
            body.organizationId = data.organizationId ?? Number(getOrganizationId());
        }
        const res = await authAwareFetch(`${REF_URL}/colors${query}`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(body),
        });
        return handleResponse(res);
    },

    async updateColorReference(id: number, data: Partial<FilamentColorReference>): Promise<FilamentColorReference> {
        const res = await authAwareFetch(`${REF_URL}/colors/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(res);
    },

    async deleteColorReference(id: number): Promise<void> {
        const res = await authAwareFetch(`${REF_URL}/colors/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to delete color reference');
    },

    async promoteColorReference(id: number): Promise<FilamentColorReference> {
        const res = await authAwareFetch(`${REF_URL}/colors/${id}/promote?admin=true`, {
            method: 'PUT',
            headers: getHeaders(),
        });
        return handleResponse(res);
    },

    // Projects
    async getProjects(): Promise<Project[]> {
        return apiFetch(`${BASE_URL}/projects`);
    },

    async getProject(id: number): Promise<Project> {
        return apiFetch(`${BASE_URL}/projects/${id}`);
    },

    async createProject(data: Partial<Project>): Promise<Project> {
        return apiFetch(`${BASE_URL}/projects`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
    async updateProject(id: number, data: Partial<Project>): Promise<Project> {
        return apiFetch(`${BASE_URL}/projects/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    },

    async deleteProject(id: number, deleteConsumptions: boolean = false): Promise<void> {
        const query = deleteConsumptions ? '?deleteConsumptions=true' : '';
        const res = await authAwareFetch(`${BASE_URL}/projects/${id}${query}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to delete project');
    },

    async addProjectItem(projectId: number, data: any): Promise<ProjectItem> {
        const res = await authAwareFetch(`${BASE_URL}/projects/${projectId}/items`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to add project item');
        return res.json();
    },

    async removeProjectItem(projectId: number, itemId: number): Promise<void> {
        const res = await authAwareFetch(`${BASE_URL}/projects/${projectId}/items/${itemId}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to remove project item');
    },

    async updateProjectItem(projectId: number, itemId: number, data: Partial<ProjectItem>): Promise<ProjectItem> {
        const res = await authAwareFetch(`${BASE_URL}/projects/${projectId}/items/${itemId}`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to update project item');
        return res.json();
    },

    async addProjectExternalItem(projectId: number, data: Omit<ProjectExternalItem, 'id' | 'projectId'>): Promise<ProjectExternalItem> {
        const res = await authAwareFetch(`${BASE_URL}/projects/${projectId}/external-items`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to add external project item');
        return res.json();
    },

    async removeProjectExternalItem(projectId: number, itemId: number): Promise<void> {
        const res = await authAwareFetch(`${BASE_URL}/projects/${projectId}/external-items/${itemId}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to remove external project item');
    },

    async updateProjectExternalItem(projectId: number, itemId: number, data: Partial<ProjectExternalItem>): Promise<ProjectExternalItem> {
        const res = await authAwareFetch(`${BASE_URL}/projects/${projectId}/external-items/${itemId}`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to update external project item');
        return res.json();
    },

    async addProjectConsumption(projectId: number, data: any): Promise<ConsumptionLog> {
        const res = await authAwareFetch(`${BASE_URL}/projects/${projectId}/consumption`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to add consumption');
        return res.json();
    },

    async deleteProjectConsumption(projectId: number, logId: number): Promise<void> {
        const res = await authAwareFetch(`${BASE_URL}/projects/${projectId}/consumption/${logId}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to delete consumption');
    },

    async updateProjectConsumption(projectId: number, logId: number, data: any): Promise<ConsumptionLog> {
        const res = await authAwareFetch(`${BASE_URL}/projects/${projectId}/consumption/${logId}`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to update consumption');
        return res.json();
    },
    async convertProjectConsumptions(projectId: number): Promise<{ count: number }> {
        const res = await authAwareFetch(`${BASE_URL}/filaments/project/${projectId}/convert`, {
            method: 'POST',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to convert consumptions');
        return res.json();
    },

    async uploadProjectFile(projectId: number, file: File): Promise<{ file: ProjectFile, analysis?: GCodeAnalysisResult }> {
        const formData = new FormData();
        formData.append('file', file);

        const headers = getHeaders();
        // @ts-ignore
        delete headers['Content-Type']; // Let browser set boundary

        const res = await authAwareFetch(`${BASE_URL}/projects/${projectId}/files`, {
            method: 'POST',
            headers: headers,
            body: formData,
        });
        if (!res.ok) throw new Error('Failed to upload file');
        return res.json();
    },

    async analyzeProjectFile(projectId: number, fileId: number): Promise<void> {
        const res = await authAwareFetch(`${BASE_URL}/projects/${projectId}/files/${fileId}/analyze`, {
            method: 'POST',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to analyze project file');
    },

    async deleteProjectFile(projectId: number, fileId: number): Promise<void> {
        const res = await authAwareFetch(`${BASE_URL}/projects/${projectId}/files/${fileId}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to delete project file');
    },

    // --- Brand Catalog ---

    async createBrandCatalogEntry(brandId: number, materialId: number, typeId: number, isGlobal: boolean = false, organizationId?: number) {
        const query = isGlobal ? '?admin=true' : '';
        const body: any = { brandId, materialId, typeId };
        if (!isGlobal) {
            body.organizationId = organizationId ?? Number(getOrganizationId());
        }
        const res = await authAwareFetch(`${REF_URL}/brand-catalog${query}`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed to create catalog entry');
        return res.json();
    },

    async getBrandCatalog(organizationId?: string | number, admin: boolean = false): Promise<BrandCatalogEntry[]> {
        const orgId = organizationId || getOrganizationId();
        const queryParams = [];
        if (orgId) queryParams.push(`organizationId=${orgId}`);
        if (admin) queryParams.push('admin=true');

        const query = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
        return apiFetch(`${REF_URL}/brand-catalog${query}`);
    },

    async promoteBrandCatalogEntry(id: number): Promise<BrandCatalogEntry> {
        const res = await authAwareFetch(`${REF_URL}/brand-catalog/${id}/promote?admin=true`, {
            method: 'PUT',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to promote entry');
        return res.json();
    },

    // Consumption & Inventory

    async updateBrandCatalogEntry(id: number, data: any): Promise<BrandCatalogEntry> {
        const res = await authAwareFetch(`${REF_URL}/brand-catalog/${id}`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to update catalog entry');
        return res.json();
    },

    async deleteBrandCatalogEntry(id: number): Promise<void> {
        const res = await authAwareFetch(`${REF_URL}/brand-catalog/${id}?admin=true`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to delete catalog entry');
    },

    async inspectGCode(file: File, onProgress?: (pct: number) => void): Promise<{ jobId: string; status: string }> {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', file);

            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${BASE_URL}/gcode/inspect`);
            xhr.withCredentials = true;

            if (authToken) {
                xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
            }
            const orgId = getOrganizationId();
            if (orgId) {
                xhr.setRequestHeader('x-organization-id', orgId);
            }

            if (onProgress) {
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        onProgress(Math.round((e.loaded / e.total) * 100));
                    }
                };
            }

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        resolve(JSON.parse(xhr.responseText));
                    } catch (err) {
                        reject(new Error('Invalid JSON response'));
                    }
                } else {
                    try {
                        const err = JSON.parse(xhr.responseText);
                        reject(new Error(err.message || 'Failed to inspect GCode'));
                    } catch {
                        reject(new Error('Failed to inspect GCode'));
                    }
                }
            };

            xhr.onerror = () => reject(new Error('Network error during upload'));
            xhr.send(formData);
        });
    },

    async computeGCode(file: File, toolToSpool?: Record<string, string>, spools?: Record<string, { densityGcm3: number }>): Promise<{ jobId: string; status: string }> {
        const formData = new FormData();
        formData.append('file', file);
        if (toolToSpool) formData.append('toolToSpool', JSON.stringify(toolToSpool));
        if (spools) formData.append('spools', JSON.stringify(spools));

        // Re-implementing headers logic for FormData
        const headers: any = {};
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }
        const orgId = getOrganizationId();
        if (orgId) {
            headers['x-organization-id'] = orgId;
        }

        const res = await authAwareFetch(`${BASE_URL}/gcode/compute`, {
            method: 'POST',
            headers,
            body: formData,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Failed to compute GCode');
        }
        return res.json();
    },

    async getJobStatus(id: string): Promise<{ id: string; status: string; progress: number; result?: any; error?: string }> {
        return apiFetch(`${BASE_URL}/gcode/job/${id}`);
    },

    async getJobs(): Promise<Array<{ id: string; name: string; progress: number; status: string; data: any }>> {
        return apiFetch(`${BASE_URL}/gcode/jobs`);
    },

    // Consumption & Inventory


    async getConsumptionHistory(id: number) {
        return apiFetch(`${API_URL}/${id}/consumption`);
    },

    async getStorageUnits(): Promise<StorageUnit[]> {
        return apiFetch(`${API_URL}/storage/units`);
    },

    async createStorageUnit(data: Partial<StorageUnit>): Promise<StorageUnit> {
        return apiFetch(`${API_URL}/storage/units`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    async updateStorageUnit(id: number, data: Partial<StorageUnit>): Promise<StorageUnit> {
        return apiFetch(`${API_URL}/storage/units/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    async deleteStorageUnit(id: number): Promise<void> {
        return apiFetch(`${API_URL}/storage/units/${id}`, {
            method: 'DELETE',
        });
    },

    async placeFilament(filamentId: number, data: { storageUnitId?: number | null; storageLevel?: number | null; storageSlot?: number | null }): Promise<Filament> {
        return apiFetch(`${API_URL}/storage/placements/${filamentId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    async getAllConsumptionHistory() {
        const orgId = getOrganizationId();
        return apiFetch(`${API_URL}/consumption/all?organizationId=${orgId}`);
    },

    async cloneFilament(id: number): Promise<Filament> {
        return apiFetch(`${API_URL}/${id}/clone`, {
            method: 'POST',
        });
    },

    // Super Admin APIs
    async getAdminFilaments(
        page: number = 1,
        limit: number = 20,
        search: string = '',
        organizationId?: number
    ): Promise<{ items: Filament[]; total: number }> {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
        });
        if (search) params.append('search', search);
        if (organizationId) params.append('organizationId', organizationId.toString());

        return apiFetch(`${BASE_URL}/admin/filaments?${params.toString()}`);
    },

    async getAdminOrganizations(): Promise<Organization[]> {
        return apiFetch(`${BASE_URL}/admin/organizations`);
    },

    mergeReferenceData: async (type: 'brand' | 'material' | 'type', sourceId: number, targetId: number) => {
        return apiFetch(`${BASE_URL}/filaments/admin/merge-reference-data`, {
            method: 'POST',
            body: JSON.stringify({ type, sourceId, targetId })
        });
    },
    async clearUserTokens(userId: number): Promise<{ success: boolean; count: number }> {
        return apiFetch(`${BASE_URL}/fcm/clear-tokens/${userId}`, {
            method: 'POST',
        });
    },

    // Audit Logs
    async getAuditLogs(params: Record<string, any>): Promise<{ items: AuditLog[]; total: number }> {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                searchParams.append(key, value.toString());
            }
        });
        return apiFetch(`${BASE_URL}/admin/audit-logs?${searchParams.toString()}`);
    },

    async getAuditLogStats(): Promise<AuditLogStats> {
        return apiFetch(`${BASE_URL}/admin/audit-logs/stats`);
    },

    async getApiKeys(): Promise<ApiKeySummary[]> {
        return apiFetch(`${BASE_URL}/api-keys`);
    },

    async getApiKeyScopes(): Promise<{ data: string[] }> {
        return apiFetch(`${BASE_URL}/api-keys/scopes`);
    },

    async createApiKey(input: string | CreateApiKeyInput): Promise<{ key: string; apiKey: ApiKeySummary }> {
        const body = typeof input === 'string' ? { name: input } : input;
        return apiFetch(`${BASE_URL}/api-keys`, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    },

    async revokeApiKey(id: number): Promise<ApiKeySummary> {
        return apiFetch(`${BASE_URL}/api-keys/${id}`, {
            method: 'DELETE',
        });
    },

    async deleteApiKey(id: number): Promise<{ id: number }> {
        return apiFetch(`${BASE_URL}/api-keys/${id}?hard=true`, {
            method: 'DELETE',
        });
    },

    async submitSupportTicket(formData: FormData): Promise<any> {
        const headers: any = {};
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }
        const orgId = getOrganizationId();
        if (orgId) {
            headers['x-organization-id'] = orgId;
        }

        const response = await authAwareFetch(`${BASE_URL}/support/ticket`, {
            method: 'POST',
            headers,
            body: formData
        });
        if (!response.ok) throw new Error('Failed to submit support ticket');
        return response.json();
    },

    confirmGcodeMappings: async (
        mappings: Array<{ hint: any; filamentId: number }>,
    ) => apiFetch(`${BASE_URL}/gcode/mappings/confirm`, {
        method: 'POST',
        body: JSON.stringify({ mappings }),
    }),
};

// --- AI Agent ---
export interface AiEngineChatResponse {
    intent: string;
    answer: string;
    requires_confirmation?: boolean;
    proposed_actions?: Array<{
        type: string;
        label: string;
        payload: Record<string, any>;
        requires_confirmation?: boolean;
    }>;
    data?: any;
}

export interface AiEngineCapabilities {
    tier: string;
    language: string;
    intents: Array<{ name: string; description: string }>;
    tools: Array<{ name: string; description: string }>;
    limitations: string[];
    llm?: {
        provider: string;
        available: boolean;
        required: boolean;
    };
}

export interface AiEngineStatus {
    status: string;
    service: string;
    version: string;
    environment: string;
    data_source: string;
    api_connected: boolean;
    api_base_url?: string | null;
    fallback_reason?: string | null;
    mode: 'api' | 'demo_offline' | string;
    llm: {
        provider: string;
        available: boolean;
        required: boolean;
    };
}

export interface AiMemoryRecord {
    id: string;
    workspace_id: string;
    user_id: string;
    type: 'preference' | 'correction' | 'learned_rule' | 'feedback';
    content: string;
    tags: string[];
    metadata: Record<string, any>;
    created_at: string;
    updated_at: string;
}

export interface ReplenishmentSuggestion {
    provider_id: string;
    provider_name: string;
    country: string;
    title: string;
    url: string;
    score: number;
    relevance: 'exact' | 'close_color' | 'fallback' | string;
    query: string;
    matched_color: {
        name: string;
        hex?: string | null;
        distance?: number | null;
        score: number;
    };
    reasons: string[];
}

export interface ReplenishmentResponse {
    item_id: string;
    country: string;
    quantity_kg: number;
    matching_policy: {
        brand: string;
        material: string;
        material_type: string;
        color: string;
    };
    suggestions: ReplenishmentSuggestion[];
}

const getAiUserId = (): string => {
    const raw = localStorage.getItem('auth_user');
    if (!raw) return 'web-user';
    try {
        const user = JSON.parse(raw);
        return String(user.id || user.userId || user.sub || user.username || 'web-user');
    } catch {
        return 'web-user';
    }
};

const getAiEngineHeaders = (plan?: string): HeadersInit => {
    const orgId = getOrganizationId() || 'web-workspace';
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'x-workspace-id': orgId,
        'x-organization-id': orgId,
        'x-user-id': getAiUserId(),
        'x-plan': plan || localStorage.getItem('organization_plan') || 'free',
    };
    const effectiveToken = authToken || localStorage.getItem('auth_token');
    if (effectiveToken) {
        headers['Authorization'] = `Bearer ${effectiveToken}`;
    }
    return headers;
};

const aiEngineFetch = async (path: string, options: RequestInit = {}, plan?: string) => {
    const response = await fetch(`${AI_ENGINE_URL}${path}`, {
        ...options,
        headers: {
            ...getAiEngineHeaders(plan),
            ...options.headers,
        },
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail?.message || error.message || 'AI Engine Error');
    }
    if (response.status === 204) {
        return undefined;
    }
    return response.json();
};

export const askAgent = async (
    question: string,
    // Conservé pour la compatibilité des appelants; l'identité/plan vient désormais du JWT côté NestJS.
    options: { plan?: string; conversationId?: string; clientContext?: AiClientContext } = {},
): Promise<AiEngineChatResponse> => {
    return apiFetch(`${BASE_URL}/ai/ask`, {
        method: 'POST',
        body: JSON.stringify({ question, clientContext: options.clientContext }),
    });
};

export interface AiTierStatus {
    tier: 'pro' | 'free' | string;
    persistentIntelligence: boolean;
    engine?: { available?: boolean; dataSource?: string | null } | null;
}

export const aiStatus = async (): Promise<AiTierStatus> => apiFetch(`${BASE_URL}/ai/status`, { method: 'GET' });

export const aiEngine = {
    status: async (): Promise<AiEngineStatus> => aiEngineFetch('/status', { method: 'GET' }),
    capabilities: async (): Promise<AiEngineCapabilities> => aiEngineFetch('/capabilities', { method: 'GET' }),
    chat: askAgent,
    memories: async (): Promise<{ items: AiMemoryRecord[] }> => aiEngineFetch('/memory', { method: 'GET' }),
    createMemory: async (content: string, type: AiMemoryRecord['type'] = 'preference'): Promise<AiMemoryRecord> => (
        aiEngineFetch('/memory', {
            method: 'POST',
            body: JSON.stringify({ type, content }),
        })
    ),
    deleteMemory: async (id: string): Promise<void> => {
        await aiEngineFetch(`/memory/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    risks: async (plan: string = 'pro', includeEmpty: boolean = false): Promise<any> => (
        aiEngineFetch(`/risks?include_empty=${includeEmpty ? 'true' : 'false'}`, { method: 'GET' }, plan)
    ),
    notificationProposals: async (plan: string = 'pro', includeEmpty: boolean = false): Promise<any> => (
        aiEngineFetch(`/notifications/proposals?include_empty=${includeEmpty ? 'true' : 'false'}`, { method: 'GET' }, plan)
    ),
    stockForecast: async (plan: string = 'pro', includeEmpty: boolean = false): Promise<any> => (
        aiEngineFetch(`/forecast/stock?include_empty=${includeEmpty ? 'true' : 'false'}`, { method: 'GET' }, plan)
    ),
    analytics: async (
        granularity: 'day' | 'week' | 'month' = 'day',
        plan: string = localStorage.getItem('organization_plan') || 'free',
    ): Promise<AnalyticsOverview> => {
        try {
            const data = await aiEngineFetch(
                `/analytics/overview?granularity=${granularity}`,
                { method: 'GET' },
                plan,
            );
            return { ...data, source: data.source === 'mock_fallback' ? 'api' : 'engine' };
        } catch {
            // Repli local : recalcule à partir de l'historique et du stock déjà accessibles.
            const [logs, filaments] = await Promise.all([
                api.getAllConsumptionHistory(),
                api.getAll(),
            ]);
            const list = Array.isArray(logs) ? logs : ((logs as any)?.logs ?? []);
            const { computeLocalAnalytics } = await import('./utils/analytics-fallback');
            return computeLocalAnalytics(list as any, (filaments || []) as any, granularity);
        }
    },
    replenishmentSuggestions: async (
        itemId: string,
        plan: string = 'pro',
        country?: string,
    ): Promise<ReplenishmentResponse> => {
        const params = new URLSearchParams();
        if (country) params.set('country', country);
        const query = params.toString() ? `?${params.toString()}` : '';
        return aiEngineFetch(`/replenishment/stock/${encodeURIComponent(itemId)}${query}`, { method: 'GET' }, plan);
    },
};

export const aiActions = {
    list: async (status?: string) =>
        apiFetch(`${BASE_URL}/ai/actions${status ? `?status=${encodeURIComponent(status)}` : ''}`, { method: 'GET' }),
    approve: async (id: string) =>
        apiFetch(`${BASE_URL}/ai/actions/${encodeURIComponent(id)}/approve`, { method: 'POST' }),
    reject: async (id: string) =>
        apiFetch(`${BASE_URL}/ai/actions/${encodeURIComponent(id)}/reject`, { method: 'POST' }),
};

export const aiMemories = {
    list: async () => apiFetch(`${BASE_URL}/ai/memories`, { method: 'GET' }),
    delete: async (id: string) => apiFetch(`${BASE_URL}/ai/memories/${encodeURIComponent(id)}/delete`, { method: 'POST' }),
};
