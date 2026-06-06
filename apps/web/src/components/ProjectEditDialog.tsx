import { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, MenuItem, Grid
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ProjectStatus } from '../api';
import type { Project } from '../api';

interface ProjectEditDialogProps {
    open: boolean;
    onClose: () => void;
    project: Project;
    onSave: (updates: Partial<Project>) => Promise<void>;
}

export default function ProjectEditDialog({ open, onClose, project, onSave }: ProjectEditDialogProps) {
    const { t } = useTranslation();
    const [name, setName] = useState(project.name);
    const [status, setStatus] = useState<ProjectStatus>(project.status);
    const [startDate, setStartDate] = useState(project.start_date ? new Date(project.start_date).toISOString().split('T')[0] : '');
    const [endDate, setEndDate] = useState(project.end_date ? new Date(project.end_date).toISOString().split('T')[0] : '');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            setName(project.name);
            setStatus(project.status);
            setStartDate(project.start_date ? new Date(project.start_date).toISOString().split('T')[0] : '');
            setEndDate(project.end_date ? new Date(project.end_date).toISOString().split('T')[0] : '');
        }
    }, [open, project]);

    const handleSave = async () => {
        setLoading(true);
        try {
            await onSave({
                name,
                status,
                start_date: startDate ? new Date(startDate).toISOString() : null,
                end_date: endDate ? new Date(endDate).toISOString() : null
            });
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{t('projects.edit', 'Edit Project')}</DialogTitle>
            <DialogContent>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid size={{ xs: 12 }}>
                        <TextField
                            label={t('projects.name', 'Name')}
                            fullWidth
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <TextField
                            select
                            label={t('projects.status', 'Status')}
                            fullWidth
                            value={status}
                            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                        >
                            {Object.values(ProjectStatus).map((s) => (
                                <MenuItem key={s} value={s}>{t(`projects.status_${s}`)}</MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                        <TextField
                            label={t('projects.startDate', 'Start Date')}
                            type="date"
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                        <TextField
                            label={t('projects.endDate', 'End Date')}
                            type="date"
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={loading}>{t('common.cancel', 'Cancel')}</Button>
                <Button onClick={handleSave} variant="contained" disabled={loading}>{t('common.save', 'Save')}</Button>
            </DialogActions>
        </Dialog>
    );
}
