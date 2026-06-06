import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
    Box, Typography, Button, Grid, Card, CardContent,
    TextField, MenuItem, LinearProgress, Alert
} from '@mui/material';
import { ArrowLeft, Save } from 'lucide-react';
import { api, ProjectStatus } from '../api';
import type { Project } from '../api';
import { useTranslation } from 'react-i18next';

export default function ProjectFormPage() {
    const { id } = useParams();
    const { t } = useTranslation();
    const isEdit = Boolean(id);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    // const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const aiFilamentId = searchParams.get('filamentId');
    const aiWeightRequiredG = searchParams.get('weightRequiredG');
    const isAiPrefilled = searchParams.get('source') === 'ai';

    const [formData, setFormData] = useState<Partial<Project>>({
        name: '',
        description: '',
        status: ProjectStatus.PLANNING,
    });

    useEffect(() => {
        if (isEdit && id) {
            loadProject(Number(id));
            return;
        }
        const aiName = searchParams.get('name');
        const aiDescription = searchParams.get('description');
        setFormData(prev => ({
            ...prev,
            ...(aiName ? { name: aiName } : {}),
            ...(aiDescription ? { description: aiDescription } : {}),
        }));
    }, [id, isEdit, searchParams]);

    const loadProject = async (projectId: number) => {
        try {
            setLoading(true);
            const data = await api.getProject(projectId);
            setFormData(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            let result: Project;
            if (isEdit && id) {
                result = await api.updateProject(Number(id), formData);
            } else {
                result = await api.createProject(formData);
                if (aiFilamentId && aiWeightRequiredG) {
                    await api.addProjectItem(result.id, {
                        filamentId: Number(aiFilamentId),
                        weight_required_g: Number(aiWeightRequiredG),
                        weight_used_g: 0,
                    });
                }
            }
            navigate(`/projects/${result.id}`);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading && isEdit) return <LinearProgress />;

    return (
        <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
            <Button
                startIcon={<ArrowLeft size={18} />}
                onClick={() => navigate('/projects')}
                sx={{ mb: 2, color: 'text.secondary' }}
            >
                Back
            </Button>

            <Typography variant="h4" fontWeight={700} gutterBottom>
                {t(isEdit ? 'projects.edit' : 'projects.new')}
            </Typography>

            {isAiPrefilled && !isEdit && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    Projet prepare par l'assistant Spooly. A la creation, le besoin matiere detecte sera ajoute automatiquement
                    {aiWeightRequiredG ? ` (${aiWeightRequiredG}g)` : ''}.
                </Alert>
            )}

            <Card variant="outlined" sx={{ borderRadius: 3 }}>
                <CardContent>
                    <form onSubmit={handleSubmit}>
                        <Grid container spacing={3}>
                            <Grid size={{ xs: 12 }}>
                                <TextField
                                    fullWidth
                                    label={t("projects.name")}
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                />
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                                <TextField
                                    fullWidth
                                    label={t("projects.description")}
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    multiline
                                    rows={4}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField
                                    select
                                    fullWidth
                                    label={t("projects.status")}
                                    name="status"
                                    value={formData.status}
                                    onChange={handleChange}
                                >
                                    {Object.values(ProjectStatus).map((status) => (
                                        <MenuItem key={status} value={status}>
                                            {t(`projects.status_${status}`)}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    size="large"
                                    startIcon={<Save size={18} />}
                                    disabled={loading}
                                >
                                    {t(isEdit ? 'projects.save' : 'projects.create')}
                                </Button>
                            </Grid>
                        </Grid>
                    </form>
                </CardContent>
            </Card>
        </Box>
    );
}
