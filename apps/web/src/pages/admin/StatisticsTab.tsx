import { Grid, Card, CardContent, Typography, Box } from '@mui/material';
import { useState, useEffect } from 'react';
import type { Organization, User } from './types';
import { BASE_URL } from '../../api';
import { useAuth } from '../../contexts/AuthContext';

export default function StatisticsTab() {
    const { token } = useAuth();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [orgsRes, usersRes] = await Promise.all([
                    fetch(`${BASE_URL}/admin/organizations?admin=true`, { headers: { 'Authorization': `Bearer ${token}` } }),
                    fetch(`${BASE_URL}/admin/users`, { headers: { 'Authorization': `Bearer ${token}` } })
                ]);
                if (orgsRes.ok) setOrganizations(await orgsRes.json());
                if (usersRes.ok) setUsers(await usersRes.json());
            } catch (error) {
                console.error('Failed to fetch stats:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [token]);

    if (loading) return <Box sx={{ p: 4, textAlign: 'center' }}>Loading statistics...</Box>;

    const stats = [
        { label: 'Total Organizations', value: organizations.length },
        { label: 'Total Users', value: users.length },
        { label: 'Pro Plans', value: organizations.filter(o => o.plan === 'pro').length },
        { label: 'Enterprise Plans', value: organizations.filter(o => o.plan === 'enterprise').length }
    ];

    return (
        <Grid container spacing={3}>
            {stats.map((stat, i) => (
                <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
                    <Card sx={{ height: '100%', borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                        <CardContent>
                            <Typography color="textSecondary" variant="body2" fontWeight="medium" gutterBottom>
                                {stat.label}
                            </Typography>
                            <Typography variant="h3" fontWeight="bold">
                                {stat.value}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            ))}
        </Grid>
    );
}
