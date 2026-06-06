import { Box, Typography, useTheme } from '@mui/material';
import type { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: LucideIcon;
    actions?: React.ReactNode;
    children?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, icon: Icon, actions, children }: PageHeaderProps) {
    const theme = useTheme();

    return (
        <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            mb: 2,
            flexWrap: 'wrap',
            gap: 2
        }}>
            {(Icon || title || subtitle) && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
                    {Icon && (
                        <Box sx={{ 
                            width: 42,
                            height: 42,
                            borderRadius: 2, 
                            bgcolor: 'primary.main', 
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(22, 97, 175, 0.15)', 
                        }}>
                            <Icon size={20} />
                        </Box>
                    )}
                    <Box>
                        {title && (
                            <Typography 
                                variant="h2" 
                                sx={{ 
                                    fontWeight: 700, 
                                    fontSize: { xs: '1.2rem', md: '1.5rem' },
                                    lineHeight: 1.2,
                                    color: theme.palette.text.primary
                                }}
                            >
                                {title}
                            </Typography>
                        )}

                        {subtitle && (
                            <Typography 
                                variant="body2"
                                color="text.secondary"
                                sx={{ mt: 0, fontWeight: 500, fontSize: '0.8rem' }}
                            >
                                {subtitle}
                            </Typography>
                        )}
                    </Box>
                </Box>
            )}

            <Box sx={{ 
                flex: 1, 
                display: 'flex', 
                alignItems: 'center', 
                px: { md: 4 },
                justifyContent: { xs: 'flex-start', md: 'center' },
                minWidth: { xs: '100%', md: 'auto' },
                order: { xs: 3, md: 2 } // Lower order on mobile to let actions sit next to title if possible
            }}>
                {children}
            </Box>
            
            {actions && (
                <Box sx={{ 
                    display: 'flex', 
                    gap: 1.5, 
                    alignItems: 'center',
                    flexShrink: 0,
                    order: { xs: 2, md: 3 }
                }}>
                    {actions}
                </Box>
            )}
        </Box>
    );
}
