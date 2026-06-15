import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setAuthToken } from '../api';

interface User {
    id: number;
    username: string;
    displayName?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    isActive?: boolean;
    isSuperAdmin?: boolean;
    systemRole?: 'super_admin' | 'admin' | 'moderator' | 'user';
    introSeen?: boolean;
    notifyOnNewSpool?: boolean;
    notifyOnConsumption?: boolean;
    notifyOnSystem?: boolean;
    notifyOnLowStock?: boolean;
    notifyOnInvitation?: boolean;
    notifyOnAiRupture?: boolean;
    notifyOnAiAchat?: boolean;
    notifyOnAiProjet?: boolean;
    needsUsername?: boolean;
    googleId?: string | null;
    appleId?: string | null;
    organisations?: Array<{ id: number; name: string; role: string; notifyOnAiAlerts?: boolean }>;
}

interface SocialLoginResponse {
    access_token: string;
    activeOrganizationId?: number;
    user: User;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (username: string, password: string) => Promise<void>;
    loginWithSocial: (provider: 'google' | 'apple', token: string) => Promise<void>;
    linkSocialProvider: (provider: 'google' | 'apple', token: string) => Promise<void>;
    unlinkSocialProvider: (provider: 'google' | 'apple') => Promise<void>;
    completeSocialSignup: (username: string, organizationName: string) => Promise<void>;
    logout: () => Promise<void>;
    updateUser: (data: Partial<User>) => void;
    activeOrganizationId: number | null;
    isLoading: boolean;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [activeOrganizationId, setActiveOrganizationId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);


    useEffect(() => {
        loadStoredAuth();
    }, []);

    const loadStoredAuth = async () => {
        try {
            const storedToken = localStorage.getItem('auth_token');
            const storedUser = localStorage.getItem('auth_user');

                if (storedToken && storedUser) {
                    setToken(storedToken);
                    setUser(JSON.parse(storedUser));
                    setAuthToken(storedToken);

                    const storedOrg = localStorage.getItem('organization_id');
                    if (storedOrg) setActiveOrganizationId(parseInt(storedOrg, 10));

                    try {
                        const profile = await api.getProfile();
                        
                        // Sync user data from server to catch stale local cache
                        if (profile) {
                            const freshUser = { ...JSON.parse(storedUser), ...profile };
                            setUser(freshUser);
                            localStorage.setItem('auth_user', JSON.stringify(freshUser));
                        }

                        if (profile.activeOrganizationId) {
                            setActiveOrganizationId(profile.activeOrganizationId);
                            localStorage.setItem('organization_id', profile.activeOrganizationId.toString());
                        } else {
                            // Server says no active org — clear stale local data
                            setActiveOrganizationId(null);
                            localStorage.removeItem('organization_id');
                        }
                    } catch (error) {
                        console.warn('Failed to sync from backend, using cached value:', error);
                    }
                } else {
                    try {
                        const session = await api.getSession();
                        handleLoginResponse(session);
                    } catch (error) {
                        // No cookie-backed session available; keep anonymous state.
                    }
                }

        } catch (error) {
            console.error('Failed to load auth:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (username: string, password: string) => {
        const response = await api.login(username, password);
        handleLoginResponse(response);
    };

    const loginWithSocial = async (provider: 'google' | 'apple', token: string) => {
        const response = await api.socialLogin(provider, token);
        handleLoginResponse(response);
    };

    const linkSocialProvider = async (provider: 'google' | 'apple', token: string) => {
        const response = await api.linkSocial(provider, token);
        handleLoginResponse(response);
    };

    const unlinkSocialProvider = async (provider: 'google' | 'apple') => {
        const response = await api.unlinkSocial(provider);
        handleLoginResponse(response);
    };

    const completeSocialSignup = async (username: string, organizationName: string) => {
        const response = await api.completeSocialSignup(username, organizationName);
        handleLoginResponse(response);
    };

    const handleLoginResponse = (response: SocialLoginResponse) => {
        setToken(response.access_token);
        setUser(response.user);

        localStorage.setItem('auth_token', response.access_token);
        localStorage.setItem('auth_user', JSON.stringify(response.user));

        setAuthToken(response.access_token);

        if (response.activeOrganizationId) {
            setActiveOrganizationId(response.activeOrganizationId);
            localStorage.setItem('organization_id', response.activeOrganizationId.toString());
        } else {
            setActiveOrganizationId(null);
            localStorage.removeItem('organization_id');
        }
    };


    const logout = async () => {
        try {
            await api.logout();
        } catch (error) {
            console.warn('Failed to call backend logout:', error);
        }
        setToken(null);
        setUser(null);
        setActiveOrganizationId(null);
        setAuthToken(null);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        localStorage.removeItem('organization_id'); // Ensure org is cleared
        localStorage.removeItem('emulated_organization_id');
    };


    const updateUser = (data: Partial<User>) => {
        setUser(prev => {
            if (!prev) return null;
            const newUser = { ...prev, ...data };
            localStorage.setItem('auth_user', JSON.stringify(newUser));
            return newUser;
        });
    };

    return (
        <AuthContext.Provider value={{ user, token, login, loginWithSocial, linkSocialProvider, unlinkSocialProvider, completeSocialSignup, logout, updateUser, activeOrganizationId, isLoading }}>
            {children}
        </AuthContext.Provider>
    );

}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
