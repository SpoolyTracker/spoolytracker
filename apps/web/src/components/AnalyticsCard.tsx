import { Box, Card, CardContent, Typography } from '@mui/material';
import type { LucideIcon } from 'lucide-react';

interface AnalyticsCardProps {
    title: string;
    value: React.ReactNode;
    subtitle?: React.ReactNode; // e.g. "vs last month" or specific filament name
    icon?: LucideIcon;
    gradient: string; // css gradient string
    trend?: 'up' | 'down' | 'neutral';
    actionNode?: React.ReactNode;
}

export default function AnalyticsCard({ title, value, subtitle, icon: Icon, gradient, actionNode }: AnalyticsCardProps) {
    return (
        <Card sx={{
            background: gradient,
            color: 'white',
            height: '100%',
            borderRadius: 4,
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <Box sx={{
                position: 'absolute',
                top: -20,
                right: -20,
                opacity: 0.2, // Subtle background icon
                transform: 'rotate(15deg)'
            }}>
                {Icon && <Icon size={140} color="white" />}
            </Box>

            <CardContent sx={{ position: 'relative', zIndex: 1, p: 3, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 3,
                        bgcolor: 'rgba(255,255,255,0.2)',
                        backdropFilter: 'blur(10px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2
                    }}>
                        {Icon && <Icon size={24} color="white" />}
                    </Box>
                    {actionNode && (
                        <Box sx={{ zIndex: 10 }}>
                            {actionNode}
                        </Box>
                    )}
                </Box>

                <Box>
                    <Typography variant="h3" fontWeight="bold" sx={{ mb: 0.5, textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                        {value}
                    </Typography>
                    <Typography variant="body1" sx={{ opacity: 0.9, fontWeight: 500 }}>
                        {title}
                    </Typography>
                    {subtitle && (
                        <Typography variant="caption" sx={{ opacity: 0.7, mt: 1, display: 'block' }}>
                            {subtitle}
                        </Typography>
                    )}
                </Box>
            </CardContent>
        </Card>
    );
}
