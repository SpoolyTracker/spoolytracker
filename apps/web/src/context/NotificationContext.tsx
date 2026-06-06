import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import type { Notification } from '../api';
import { useAuth } from '../contexts/AuthContext';

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    isLoading: boolean;
    refresh: () => Promise<void>;
    markAsRead: (id: number) => Promise<void>;
    markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    const refresh = useCallback(async () => {
        if (!user) return;
        try {
            // Don't set loading on refresh to avoid flickering if polling
            const data = await api.getNotifications();
            setNotifications(data.notifications);
            setUnreadCount(data.unreadCount);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        }
    }, [user]);

    // Initial fetch
    useEffect(() => {
        let eventSource: EventSource | null = null;

        if (user) {
            setIsLoading(true);
            refresh().finally(() => setIsLoading(false));

            // Setup SSE stream
            eventSource = api.createNotificationStream();

            eventSource.onopen = () => {
                console.log('SSE connection opened');
            };

            eventSource.onmessage = (event) => {
                console.log('New SSE message:', event.data);
                try {
                    const parsed = JSON.parse(event.data);
                    if (parsed) {
                        setNotifications(prev => [parsed, ...prev]);
                        setUnreadCount(prev => prev + 1);

                        // Watch for real-time quota guard triggers
                        let notifData = parsed.data;
                        if (typeof notifData === 'string') {
                            try {
                                notifData = JSON.parse(notifData);
                            } catch (e) {
                                console.warn('Could not parse notification data string', e);
                            }
                        }

                        if (notifData?.action === 'REQUIRE_QUOTA_RESOLUTION') {
                            window.location.href = '/resolve-quota';
                        } else if (notifData?.action === 'PLAN_UPDATED') {
                            window.location.reload();
                        } else if (notifData?.action === 'QUOTA_UNLOCKED') {
                            // If they are on resolve quota, take them home. Otherwise, just reload to clear locks.
                            if (window.location.pathname === '/resolve-quota') {
                                window.location.href = '/dashboard';
                            } else {
                                window.dispatchEvent(new Event('inventory-updated'));
                                window.location.reload();
                            }
                        }
                    }
                } catch (e) {
                    console.error('Failed to parse SSE notification', e);
                }
            };

            eventSource.onerror = (error) => {
                console.error('SSE Error:', error);
                // The browser will automatically try to reconnect.
                // You could add logic here to manually close and reopen after exponential backoff if needed,
                // but native behavior is often sufficient.
            };

        } else {
            setNotifications([]);
            setUnreadCount(0);
        }

        return () => {
            if (eventSource) {
                eventSource.close();
            }
        };
    }, [user, refresh]);

    const markAsRead = async (id: number) => {
        try {
            await api.markNotificationRead(id);
            // Optimistic update
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
            refresh(); // Revert on failure
        }
    };

    const markAllAsRead = async () => {
        try {
            await api.markAllNotificationsRead();
            // Optimistic update
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Failed to mark all as read:', error);
            refresh();
        }
    };

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, isLoading, refresh, markAsRead, markAllAsRead }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};
