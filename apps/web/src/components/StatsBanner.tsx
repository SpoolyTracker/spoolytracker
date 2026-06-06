import { Box, Card, Typography, LinearProgress, Chip } from '@mui/material';

import type { LucideIcon } from 'lucide-react';
import { alpha } from '@mui/material/styles';


interface StatItemProps {
    label: string;
    value: string | number;
    total?: string | number;
    icon: LucideIcon;
    color: string;
    progress?: number;
    chips?: { label: string, color?: "error" | "warning" | "info" | "success" | "default" | "primary" | "secondary", icon?: LucideIcon }[];
    variant?: 'default' | 'compact';
}

const StatItem = ({ label, value, total, icon: Icon, color, progress, chips, variant = 'default' }: StatItemProps) => {
    const displayValue = (value === Infinity || value === 'Infinity') ? '∞' : value;
    const displayTotal = (total === Infinity || total === 'Infinity' || total === -1) ? '∞' : total;

    if (variant === 'compact') {
        return (
            <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1.5,
                px: 2,
                py: 0.5,
                borderRadius: 2,
                bgcolor: alpha(color, 0.05),
                border: '1px solid',
                borderColor: alpha(color, 0.1),
            }}>
                <Box sx={{ 
                    width: 32, 
                    height: 32, 
                    borderRadius: 1.5, 
                    bgcolor: alpha(color, 0.1), 
                    color: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                }}>
                    <Icon size={16} />
                </Box>
                <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.6rem', display: 'block', lineHeight: 1 }}>
                        {label}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                        <Typography variant="body1" sx={{ fontWeight: 700, lineHeight: 1.2, fontSize: '1rem' }}>
                            {displayValue}
                        </Typography>
                        {displayTotal !== undefined && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                                / {displayTotal}
                            </Typography>
                        )}
                    </Box>
                </Box>
                {chips && chips.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                        {chips.map((chip, idx) => {
                            const { icon: ChipIcon } = chip;
                            return (
                                <Chip 
                                    key={idx}
                                    size="small"
                                    icon={ChipIcon ? <ChipIcon size={10} /> : undefined}
                                    label={chip.label}
                                    color={chip.color || 'default'}
                                    variant="outlined"
                                    sx={{ height: 16, fontSize: '0.6rem', fontWeight: 600 }}
                                />
                            );
                        })}
                    </Box>
                )}
            </Box>
        );
    }
    
    return (
        <Card sx={{ 
            flex: 1, 
            minWidth: { xs: '100%', sm: 200 }, 
            p: 2.5, 
            borderRadius: 4,
            border: '1px solid',
            borderColor: alpha(color, 0.1),
            bgcolor: alpha(color, 0.03),
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: `0 8px 20px ${alpha(color, 0.08)}`,
                borderColor: alpha(color, 0.2),
            },
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5
        }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ 
                    width: 42, 
                    height: 42, 
                    borderRadius: 2.5, 
                    bgcolor: alpha(color, 0.1), 
                    color: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Icon size={22} />
                </Box>
                {chips && chips.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {chips.map((chip, idx) => {
                            const { icon: ChipIcon } = chip;
                            return (
                                <Chip 
                                    key={idx}
                                    size="small"
                                    icon={ChipIcon ? <ChipIcon size={12} /> : undefined}
                                    label={chip.label}
                                    color={chip.color || 'default'}
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                                />
                            );
                        })}
                    </Box>
                )}
            </Box>

            <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {label}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
                    <Typography variant="h4" sx={{ fontWeight: 800 }}>
                        {displayValue}
                    </Typography>
                    {displayTotal !== undefined && (
                        <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
                            / {displayTotal}
                        </Typography>
                    )}
                </Box>
            </Box>

            {progress !== undefined && (
                <Box sx={{ mt: 'auto' }}>
                    <LinearProgress 
                        variant="determinate" 
                        value={Math.min(100, progress)} 
                        sx={{ 
                            height: 6, 
                            borderRadius: 3,
                            bgcolor: alpha(color, 0.1),
                            '& .MuiLinearProgress-bar': {
                                bgcolor: color,
                                borderRadius: 3
                            }
                        }}
                    />
                </Box>
            )}
        </Card>
    );
};

interface StatsBannerProps {
    stats: StatItemProps[];
    variant?: 'default' | 'compact';
}

export default function StatsBanner({ stats, variant = 'default' }: StatsBannerProps) {
    return (
        <Box sx={{ 
            display: 'flex', 
            gap: variant === 'compact' ? 1.5 : 2, 
            mb: variant === 'compact' ? 0 : 4, 
            flexWrap: 'wrap',
            justifyContent: variant === 'compact' ? 'center' : 'flex-start'
        }}>
            {stats.map((stat, index) => (
                <StatItem key={index} {...stat} variant={variant} />
            ))}
        </Box>
    );
}
