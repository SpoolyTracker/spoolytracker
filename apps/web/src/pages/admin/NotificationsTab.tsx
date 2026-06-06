import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { BASE_URL } from '../../api';
import AdminNotificationsTab from '../../components/AdminNotificationsTab';
import { Snackbar, Alert } from '@mui/material';
import type { User } from './types';

export default function NotificationsTab() {
    const { token } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info' }>({ open: false, message: '', severity: 'success' });

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await fetch(`${BASE_URL}/admin/users`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                if (response.ok) {
                    setUsers(await response.json());
                }
            } catch (error) {
                console.error('Failed to fetch users for notifications:', error);
            }
        };
        fetchUsers();
    }, [token]);

    return (
        <>
            <AdminNotificationsTab users={users} setSnackbar={setSnackbar as any} />
            <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
                <Alert onClose={() => setSnackbar(s => ({ ...s, open: false }))} severity={snackbar.severity as any} sx={{ width: '100%', borderRadius: 2 }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </>
    );
}
