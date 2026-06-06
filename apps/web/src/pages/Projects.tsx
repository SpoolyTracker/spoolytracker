
import { useEffect, useState } from 'react';
import { Box, Typography, Button, Grid, Card, CardContent, Chip, CardActionArea, useTheme, Tooltip } from '@mui/material';
import { Plus, Calendar, Package, Folder, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, ProjectStatus, BASE_URL } from '../api';
import type { Project } from '../api';
import { useTranslation } from 'react-i18next';
import { SecureImage } from '../components/SecureImage';
import PageHeader from '../components/PageHeader';
import StatsBanner from '../components/StatsBanner';
export default function ProjectsPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [organization, setOrganization] = useState<any>(null);
    const navigate = useNavigate();
    const theme = useTheme();
    const { t } = useTranslation();

    const stats = {
        total: projects.length,
        inProgress: projects.filter(p => p.status === ProjectStatus.IN_PROGRESS).length,
        completed: projects.filter(p => p.status === ProjectStatus.COMPLETED).length
    };


    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        try {
            setLoading(true);
            const orgId = localStorage.getItem('organization_id') || '1';
            const [data, orgData] = await Promise.all([
                api.getProjects(),
                api.getOrgData(orgId)
            ]);
            setProjects(data);
            setOrganization(orgData);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: ProjectStatus) => {
        switch (status) {
            case ProjectStatus.PLANNING: return 'info';
            case ProjectStatus.IN_PROGRESS: return 'warning';
            case ProjectStatus.COMPLETED: return 'success';
            case ProjectStatus.ARCHIVED: return 'default';
            default: return 'default';
        }
    };

    return (
        <Box sx={{ p: 3, maxWidth: 1600, mx: 'auto' }}>
            <PageHeader 
                title={t('projects.title', 'Projects')}
                subtitle={t('projects.subtitle', 'Manage your 3D printing projects, BOMs, and costs.')}
                icon={Folder}
                actions={
                    <Button
                        variant="contained"
                        startIcon={<Plus size={20} />}
                        onClick={() => navigate('/projects/new')}
                    >
                        {t('projects.new', 'New Project')}
                    </Button>
                }
            >
                <StatsBanner 
                    variant="compact"
                    stats={[
                        {
                            label: t('projects.totalProjects', 'Total Projects'),
                            value: stats.total,
                            total: (organization?.stats?.limits?.maxProjectsPerOrg === Infinity || organization?.stats?.limits?.maxProjectsPerOrg === -1 || organization?.stats?.limits?.maxProjectsPerOrg === null) ? '∞' : organization?.stats?.limits?.maxProjectsPerOrg,
                            icon: Folder,
                            color: theme.palette.primary.main,
                        },
                        {
                            label: t('projects.activeProjects', 'Active Projects'),
                            value: stats.inProgress,
                            icon: Clock,
                            color: theme.palette.warning.main,
                        },
                        {
                            label: t('projects.completedProjects', 'Completed'),
                            value: stats.completed,
                            icon: Package,
                            color: theme.palette.success.main
                        }
                    ]}
                />
            </PageHeader>



            {loading ? (
                <Typography>{t('common.loading')}</Typography>
            ) : projects.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 8, bgcolor: 'background.paper', borderRadius: 4, border: '1px dashed', borderColor: 'divider' }}>
                    <Folder size={64} style={{ opacity: 0.2, marginBottom: 16 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                        {t('projects.noProjectsFound')}
                    </Typography>
                    <Button variant="contained" onClick={() => navigate('/projects/new')} startIcon={<Plus size={20} />}>
                        {t('projects.createFirst')}
                    </Button>
                </Box>
            ) : (
                <Grid container spacing={3}>
                    {projects.map((project) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={project.id}>
                            <Card
                                elevation={0}
                                sx={{
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    borderRadius: 3,
                                    border: `1px solid ${theme.palette.divider}`,
                                    transition: 'all 0.2s',
                                    '&:hover': {
                                        transform: 'translateY(-4px)',
                                        boxShadow: 4,
                                        borderColor: 'primary.main'
                                    }
                                }}
                            >
                                <CardActionArea onClick={() => navigate(`/projects/${project.id}`)} sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                                    {(() => {
                                        const coverFile = project.files?.find(f => ['IMAGE', 'jpg', 'png', 'webp'].includes(f.file_type) || f.file_name.match(/\.(jpg|jpeg|png|webp)$/i));

                                        let coverUrl = null;
                                        if (project.image_url) {
                                            coverUrl = project.image_url;
                                        } else if (coverFile && coverFile.file_url) {
                                            const apiUrl = BASE_URL.replace(/\/$/, '');
                                            let path = coverFile.file_url.replace(/\\/g, '/');
                                            if (path.startsWith('/')) path = path.slice(1);

                                            coverUrl = (path.startsWith('http') || path.startsWith('blob'))
                                                ? path
                                                : `${apiUrl}/${path}`;
                                        }

                                        return coverUrl ? (
                                            <SecureImage
                                                src={coverUrl}
                                                alt={project.name}
                                                style={{ width: '100%', height: 140, objectFit: 'cover' }}
                                            />
                                        ) : (
                                            <Box className="placeholder-box" sx={{ height: 140, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Package size={48} style={{ opacity: 0.2 }} />
                                            </Box>
                                        );
                                    })()}
                                    <CardContent sx={{ flexGrow: 1 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                            <Chip
                                                label={t(`projects.status_${project.status}`)}
                                                size="small"
                                                color={getStatusColor(project.status) as any}
                                                sx={{ borderRadius: 1.5, fontWeight: 600, fontSize: '0.7rem', height: 24 }}
                                            />
                                            <Box sx={{ display: 'flex', gap: 0.5, overflow: 'hidden', ml: 1 }}>
                                                {project.tags?.slice(0, 3).map((tag) => (
                                                    <Chip
                                                        key={tag}
                                                        label={tag}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{ fontSize: '0.65rem', height: 20 }}
                                                    />
                                                ))}
                                                {project.tags && project.tags.length > 3 && (
                                                    <Typography variant="caption" color="text.secondary">+{project.tags.length - 3}</Typography>
                                                )}
                                            </Box>
                                            {project.end_date && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary', fontSize: '0.75rem' }}>
                                                    <Calendar size={14} style={{ marginRight: 4 }} />
                                                    {new Date(project.end_date).toLocaleDateString()}
                                                </Box>
                                            )}
                                        </Box>
                                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, lineHeight: 1.3 }}>
                                            {project.name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                            mb: 2
                                        }}>
                                            {project.description || t('projects.noDescription')}
                                        </Typography>

                                        <Box sx={{ display: 'flex', gap: 2, mt: 'auto', pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
                                                <Package size={16} />
                                                <Typography variant="caption" sx={{ ml: 0.5 }}>{t('projects.itemsCount', { count: project.items?.length || 0 })}</Typography>
                                            </Box>
                                            <Tooltip title={t('projects.estimatedPrintTime', 'Estimated Print Time')}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
                                                    <Clock size={16} />
                                                    <Typography variant="caption" sx={{ ml: 0.5 }}>
                                                        {project.print_time_seconds ? (project.print_time_seconds / 3600).toFixed(1) : '0'}h
                                                    </Typography>
                                                </Box>
                                            </Tooltip>
                                        </Box>
                                    </CardContent>
                                </CardActionArea>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}
        </Box>
    );
}
