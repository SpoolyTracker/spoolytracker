import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    List,
    ListItem,
    ListItemAvatar,
    Avatar,
    ListItemText,
    Chip,
    Typography,
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from '@mui/material';

import { useAuth } from '../contexts/AuthContext';
// Removed unused User import

interface OrgUsersModalProps {
    open: boolean;
    onClose: () => void;
    orgId: number | null;
    orgName: string;
    allUsers?: any[];
}


interface OrgUser {
    id: number;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'owner' | 'admin' | 'member';
    joinedAt: string;
}

import { api, BASE_URL } from '../api';

export default function OrgUsersModal({ open, onClose, orgId, orgName, allUsers = [] }: OrgUsersModalProps) {
    const { token, user: currentUser } = useAuth();
    const [users, setUsers] = useState<OrgUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [addingMember, setAddingMember] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string | number>('');
    const [selectedRole, setSelectedRole] = useState<'owner' | 'admin' | 'member'>('member');


    useEffect(() => {
        if (open && orgId) {
            fetchUsers();
        } else {
            setUsers([]);
        }
    }, [open, orgId]);

    const currentOrgId = localStorage.getItem('organization_id') || '1';

    const fetchUsers = async () => {
        if (!orgId) return;
        setLoading(true);
        try {

            const response = await fetch(`${BASE_URL}/admin/organizations/${orgId}/users`, {
                headers: { 'Authorization': `Bearer ${token}`, 'x-organization-id': currentOrgId },
            });
            if (response.ok) {
                const data = await response.json();
                setUsers(data);
            }
        } catch (error) {
            console.error('Failed to fetch org users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddMember = async () => {
        if (!orgId || !selectedUserId) return;
        setAddingMember(true);
        try {
            const response = await fetch(`${BASE_URL}/admin/organizations/${orgId}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ userId: +selectedUserId, role: selectedRole }),
            });
            if (response.ok) {
                fetchUsers();
                setSelectedUserId('');
            } else {
                const err = await response.json();
                alert(err.message || 'Failed to add member');
            }
        } catch (error) {
            console.error('Failed to add member:', error);
            alert('Network error');
        } finally {
            setAddingMember(false);
        }
    };


    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                Users in {orgName}
                <Typography variant="body2" color="textSecondary">
                    {users.length} members
                </Typography>
            </DialogTitle>
            <DialogContent dividers>
                {/* Admin Quick Add */}
                <Box sx={{ pb: 3, mb: 1, borderBottom: '1px dashed #e2e8f0', display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                    <FormControl size="small" sx={{ flexGrow: 1 }}>
                        <InputLabel>Add existing user</InputLabel>
                        <Select
                            value={selectedUserId}
                            label="Add existing user"
                            onChange={(e) => setSelectedUserId(e.target.value)}
                        >
                            <MenuItem value=""><em>None</em></MenuItem>
                            {(allUsers || []).filter(u => !users.find(ou => ou.id === u.id)).map((u) => (
                                <MenuItem key={u.id} value={u.id}>
                                    {u.username} ({u.email})
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ width: 110 }}>
                        <InputLabel>Role</InputLabel>
                        <Select
                            value={selectedRole}
                            label="Role"
                            onChange={(e) => setSelectedRole(e.target.value as any)}
                        >
                            <MenuItem value="member">MEMBER</MenuItem>
                            <MenuItem value="admin">ADMIN</MenuItem>
                            <MenuItem value="owner">OWNER</MenuItem>
                        </Select>
                    </FormControl>
                    <Button 
                        variant="contained" 
                        color="primary" 
                        onClick={handleAddMember} 
                        disabled={!selectedUserId || addingMember}
                        size="medium"
                        sx={{ height: 40 }}
                    >
                        {addingMember ? '...' : 'Add'}
                    </Button>
                </Box>


                {loading ? (
                    <Box sx={{ p: 2, textAlign: 'center' }}>Loading...</Box>
                ) : users.length === 0 ? (
                    <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>No users found.</Box>
                ) : (
                    <List>
                        {users.map((user) => (
                            <ListItem key={user.id}>
                                <ListItemAvatar>
                                    <Avatar>
                                        {user.firstName ? user.firstName[0] : user.username[0]}
                                    </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography variant="subtitle2">
                                                {user.username}
                                            </Typography>
                                            {/* Role Selector for Super Admins */}
                                            {(currentUser as any)?.isSuperAdmin ? (
                                                <select
                                                    value={user.role}
                                                    onChange={async (e) => {
                                                        const newRole = e.target.value as any;
                                                        if (confirm(`Force role change to ${newRole}?`)) {
                                                            try {
                                                                await api.forceUpdateMemberRole(orgId!, user.id, newRole);
                                                                fetchUsers(); // Refresh
                                                            } catch (err) {
                                                                alert('Failed to force update role');
                                                                console.error(err);
                                                            }
                                                        }
                                                    }}
                                                    style={{
                                                        padding: '2px 4px',
                                                        borderRadius: '4px',
                                                        border: '1px solid #d1d5db',
                                                        fontSize: '12px',
                                                        color: 'red', // Highlight it's an admin action
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    <option value="member">MEMBER</option>
                                                    <option value="admin">ADMIN</option>
                                                    <option value="owner">OWNER (Careful)</option>
                                                </select>
                                            ) : (
                                                <Chip
                                                    label={user.role}
                                                    size="small"
                                                    color={user.role === 'owner' ? 'primary' : user.role === 'admin' ? 'secondary' : 'default'}
                                                    variant="outlined"
                                                    sx={{ height: 20, fontSize: 10, textTransform: 'uppercase' }}
                                                />
                                            )}
                                        </Box>
                                    }
                                    secondary={
                                        <>
                                            {user.firstName} {user.lastName} <br />
                                            {user.email}
                                        </>
                                    }
                                />
                            </ListItem>
                        ))}
                    </List>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}
