import React, { useState } from 'react';
import {
    Badge,
    IconButton,
    Popover,
    Box,
    Typography,
    List,
    ListItem,
    ListItemText,
    ListItemAvatar,
    Avatar,
    Divider,
    Button,
    useTheme,
    alpha
} from '@mui/material';
import { Bell, Check, Info, AlertTriangle, UserPlus, Sparkles } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { NotificationType, api } from '../api';
import { useTranslation } from 'react-i18next';
// Simple time ago formatter
const formatDistanceToNow = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffInSeconds = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

const NotificationBell = () => {
    const { t } = useTranslation();
    const theme = useTheme();
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const open = Boolean(anchorEl);
    const id = open ? 'notification-popover' : undefined;

    const getIcon = (type: NotificationType) => {
        switch (type) {
            case NotificationType.INVITATION: return <UserPlus size={20} />;
            case NotificationType.LOW_STOCK: return <AlertTriangle size={20} />;
            case NotificationType.AI_ALERT: return <Sparkles size={20} />;
            case NotificationType.NEW_SPOOL: return <Info size={20} />;
            case NotificationType.CONSUMPTION: return <Check size={20} />;
            case NotificationType.SYSTEM:
            default: return <Bell size={20} />;
        }
    };

    const getColor = (type: NotificationType) => {
        switch (type) {
            case NotificationType.INVITATION: return theme.palette.primary.main;
            case NotificationType.LOW_STOCK: return theme.palette.error.main;
            case NotificationType.AI_ALERT: return theme.palette.primary.main;
            case NotificationType.NEW_SPOOL: return theme.palette.success.main;
            case NotificationType.CONSUMPTION: return theme.palette.warning.main;
            case NotificationType.SYSTEM:
            default: return theme.palette.info.main;
        }
    };

    const handleMarkRead = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        markAsRead(id);
    };

    return (
        <>
            <IconButton color="primary" onClick={handleClick}>
                <Badge badgeContent={unreadCount} color="error">
                    <Bell size={20} />
                </Badge>
            </IconButton>
            <Popover
                id={id}
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
                PaperProps={{
                    sx: {
                        width: 360,
                        maxHeight: 500,
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column'
                    }
                }}
            >
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'background.default' }}>
                    <Typography variant="h6">Notifications</Typography>
                    {unreadCount > 0 && (
                        <Button size="small" onClick={() => markAllAsRead()}>
                            {t('notification.markAllRead')}
                        </Button>
                    )}
                </Box>
                <Divider />
                <List sx={{ flexGrow: 1, overflowY: 'auto', p: 0 }}>
                    {notifications.length === 0 ? (
                        <Box sx={{ p: 3, textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary">No notifications</Typography>
                        </Box>
                    ) : (
                        notifications.map((notification) => (
                            <React.Fragment key={notification.id}>
                                <ListItem
                                    alignItems="flex-start"
                                    sx={{
                                        bgcolor: notification.isRead ? 'transparent' : 'action.hover',
                                        cursor: 'pointer',
                                        transition: '0.2s',
                                        '&:hover': { bgcolor: 'action.selected' }
                                    }}
                                >
                                    <ListItemAvatar>
                                        <Avatar sx={{ bgcolor: alpha(getColor(notification.type), 0.1), color: getColor(notification.type) }}>
                                            {getIcon(notification.type)}
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={
                                            <Typography variant="subtitle2" fontWeight={notification.isRead ? 'normal' : 'bold'}>
                                                {/* Translate title if it looks like a key, otherwise render as is */}
                                                {notification.title.includes('.') ? t(notification.title) as string : notification.title}
                                            </Typography>
                                        }
                                        secondary={
                                            <React.Fragment>
                                                <Typography component="span" variant="body2" color="text.primary" sx={{ display: 'block', mb: 0.5 }}>
                                                    {/* Translate message if it looks like a key, passing data as params */}
                                                    {notification.message.includes('.') ? t(notification.message, notification.data) as string : notification.message}
                                                </Typography>
                                                {notification.type === NotificationType.INVITATION && !notification.isRead && (
                                                    <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                                                        <Button
                                                            variant="contained"
                                                            size="small"
                                                            color="success"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                api.acceptInvitation(notification.data.organizationId).then(() => {
                                                                    markAsRead(notification.id);
                                                                    window.location.reload(); // Reload to update org list/permissions
                                                                });
                                                            }}
                                                            sx={{ fontSize: '0.7rem', py: 0.5, minWidth: 'auto' }}
                                                        >
                                                            Accept
                                                        </Button>
                                                        <Button
                                                            variant="outlined"
                                                            size="small"
                                                            color="error"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                api.declineInvitation(notification.data.organizationId).then(() => {
                                                                    markAsRead(notification.id);
                                                                });
                                                            }}
                                                            sx={{ fontSize: '0.7rem', py: 0.5, minWidth: 'auto' }}
                                                        >
                                                            Decline
                                                        </Button>
                                                    </Box>
                                                )}
                                                <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                                    {formatDistanceToNow(notification.createdAt)}
                                                </Typography>
                                            </React.Fragment>
                                        }
                                    />
                                    {!notification.isRead && (
                                        <IconButton size="small" onClick={(e) => handleMarkRead(e, notification.id)} title="Mark as read">
                                            <Check size={16} />
                                        </IconButton>
                                    )}
                                </ListItem>
                                <Divider component="li" />
                            </React.Fragment>
                        ))
                    )}
                </List>
                <Box sx={{ p: 1, textAlign: 'center', borderTop: 1, borderColor: 'divider' }}>
                    <Button fullWidth size="small" onClick={handleClose}>Close</Button>
                </Box>
            </Popover>
        </>
    );
};

export default NotificationBell;
