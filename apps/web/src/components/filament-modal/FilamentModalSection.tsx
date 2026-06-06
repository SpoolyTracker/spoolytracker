import type { ReactNode } from 'react';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Paper,
    Typography,
} from '@mui/material';
import { ChevronDown } from 'lucide-react';

interface SectionHeaderProps {
    icon: ReactNode;
    title: string;
    subtitle?: string;
}

function SectionHeader({ icon, title, subtitle }: SectionHeaderProps) {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            <Box
                sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 1.5,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: 'primary.light',
                    color: 'primary.main',
                    flex: '0 0 auto',
                }}
            >
                {icon}
            </Box>
            <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {title}
                </Typography>
                {subtitle && (
                    <Typography variant="caption" color="text.secondary" noWrap>
                        {subtitle}
                    </Typography>
                )}
            </Box>
        </Box>
    );
}

interface CoreSectionProps extends SectionHeaderProps {
    children: ReactNode;
}

export function CoreSection({ icon, title, subtitle, children }: CoreSectionProps) {
    return (
        <Paper
            variant="outlined"
            sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: 'background.paper',
            }}
        >
            <Box sx={{ mb: 2 }}>
                <SectionHeader icon={icon} title={title} subtitle={subtitle} />
            </Box>
            {children}
        </Paper>
    );
}

interface CollapsibleSectionProps extends CoreSectionProps {
    defaultExpanded?: boolean;
}

export function CollapsibleSection({ icon, title, subtitle, children, defaultExpanded = false }: CollapsibleSectionProps) {
    return (
        <Accordion
            defaultExpanded={defaultExpanded}
            disableGutters
            sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                bgcolor: 'background.paper',
                '&:before': { display: 'none' },
                '&.Mui-expanded': { my: 0 },
            }}
        >
            <AccordionSummary
                expandIcon={<ChevronDown size={18} />}
                sx={{
                    minHeight: 64,
                    px: 2,
                    '& .MuiAccordionSummary-content': { my: 1.5 },
                }}
            >
                <SectionHeader icon={icon} title={title} subtitle={subtitle} />
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, px: 2, pb: 2 }}>
                {children}
            </AccordionDetails>
        </Accordion>
    );
}
