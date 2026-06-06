import type { Components, Theme } from '@mui/material/styles';
import type {} from '@mui/x-data-grid/themeAugmentation';

export const components = (theme: Theme): Components => {
    return {
        MuiButton: {
            styleOverrides: {
                root: {
                    fontWeight: 500,
                    borderRadius: '12px'
                },
                contained: {
                    boxShadow: 'none',
                    '&:hover': {
                        boxShadow: 'none'
                    }
                }
            }
        },
        MuiPaper: {
            defaultProps: {
                elevation: 0
            },
            styleOverrides: {
                root: {
                    backgroundImage: 'none'
                },
                rounded: {
                    borderRadius: '12px'
                }
            }
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    boxShadow: '0 2px 14px 0 rgb(32 40 45 / 8%)',
                    borderRadius: '12px',
                    border: '1px solid',
                    borderColor: theme.palette.mode === 'dark' ? theme.palette.divider : '#e3e8ef'
                }
            }
        },
        MuiCardHeader: {
            styleOverrides: {
                root: {
                    padding: '24px'
                },
                title: {
                    fontWeight: 600,
                    fontSize: '1.125rem'
                }
            }
        },
        MuiCardContent: {
            styleOverrides: {
                root: {
                    padding: '24px'
                }
            }
        },
        MuiListItemButton: {
            styleOverrides: {
                root: {
                    borderRadius: '12px',
                    paddingTop: '10px',
                    paddingBottom: '10px',
                    '&.Mui-selected': {
                        color: theme.palette.primary.main,
                        backgroundColor: theme.palette.primary.light,
                        '&:hover': {
                            backgroundColor: theme.palette.primary.light
                        },
                        '& .MuiListItemIcon-root': {
                            color: theme.palette.primary.main
                        }
                    },
                    '&:hover': {
                        backgroundColor: theme.palette.primary.light,
                        color: theme.palette.primary.main,
                        '& .MuiListItemIcon-root': {
                            color: theme.palette.primary.main
                        }
                    }
                }
            }
        },
        MuiListItemIcon: {
            styleOverrides: {
                root: {
                    minWidth: '36px',
                    color: 'inherit'
                }
            }
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundColor: 'transparent',
                    boxShadow: 'none'
                }
            }
        },
        // ─── Premium Table System ───────────────────────────────────
        MuiTableContainer: {
            styleOverrides: {
                root: {
                    borderRadius: '12px',
                    border: `1px solid ${theme.palette.divider}`,
                    overflow: 'hidden',
                    boxShadow: theme.palette.mode === 'dark'
                        ? '0 4px 24px rgba(0,0,0,0.25)'
                        : '0 2px 12px rgba(0,0,0,0.04)',
                }
            }
        },
        MuiTableHead: {
            styleOverrides: {
                root: {
                    '& .MuiTableCell-head': {
                        background: theme.palette.mode === 'dark'
                            ? 'linear-gradient(135deg, rgba(30,41,59,0.95) 0%, rgba(26,34,63,0.98) 100%)'
                            : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        textTransform: 'uppercase' as const,
                        letterSpacing: '0.05em',
                        color: theme.palette.text.secondary,
                        borderBottom: `2px solid ${theme.palette.mode === 'dark' ? 'rgba(99,102,241,0.25)' : 'rgba(18,119,202,0.15)'}`,
                        padding: '14px 16px',
                        whiteSpace: 'nowrap' as const,
                    }
                }
            }
        },
        MuiTableBody: {
            styleOverrides: {
                root: {
                    '& .MuiTableRow-root': {
                        transition: 'all 0.15s ease',
                        '&:hover': {
                            backgroundColor: theme.palette.mode === 'dark'
                                ? 'rgba(99,102,241,0.06)'
                                : 'rgba(18,119,202,0.03)',
                            transform: 'scale(1.001)',
                        },
                        '&:last-child .MuiTableCell-root': {
                            borderBottom: 'none',
                        }
                    }
                }
            }
        },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    borderBottom: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                    padding: '12px 16px',
                    fontSize: '0.875rem',
                    verticalAlign: 'middle',
                }
            }
        },
        MuiTableSortLabel: {
            styleOverrides: {
                root: {
                    color: theme.palette.text.secondary,
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.05em',
                    '&:hover': {
                        color: theme.palette.primary.main,
                    },
                    '&.Mui-active': {
                        color: theme.palette.primary.main,
                        '& .MuiTableSortLabel-icon': {
                            color: theme.palette.primary.main,
                        }
                    }
                }
            }
        },
        MuiTablePagination: {
            styleOverrides: {
                root: {
                    borderTop: `1px solid ${theme.palette.divider}`,
                }
            }
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    fontWeight: 600,
                    borderRadius: '8px',
                },
                sizeSmall: {
                    fontSize: '0.75rem',
                    height: '24px',
                }
            }
        },
        // ─── Premium DataGrid System ────────────────────────────────
        MuiDataGrid: {
            styleOverrides: {
                root: {
                    border: 'none',
                    borderRadius: '12px',
                    '& .MuiDataGrid-main': {
                        borderRadius: '12px',
                    },
                },
                columnHeaders: {
                    background: theme.palette.mode === 'dark'
                        ? 'linear-gradient(135deg, rgba(30,41,59,0.95) 0%, rgba(26,34,63,0.98) 100%)'
                        : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    borderBottom: `2px solid ${theme.palette.mode === 'dark' ? 'rgba(99,102,241,0.25)' : 'rgba(18,119,202,0.15)'}`,
                },
                columnHeader: {
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.05em',
                    color: theme.palette.text.secondary,
                    '&:focus, &:focus-within': {
                        outline: 'none',
                    },
                },
                columnHeaderTitle: {
                    fontWeight: 700,
                },
                cell: {
                    borderBottom: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    '&:focus, &:focus-within': {
                        outline: 'none',
                    },
                },
                row: {
                    transition: 'background-color 0.15s ease',
                    '&:hover': {
                        backgroundColor: theme.palette.mode === 'dark'
                            ? 'rgba(99,102,241,0.06)'
                            : 'rgba(18,119,202,0.03)',
                    },
                    '&.Mui-selected': {
                        backgroundColor: theme.palette.mode === 'dark'
                            ? 'rgba(99,102,241,0.12)'
                            : 'rgba(18,119,202,0.08)',
                        '&:hover': {
                            backgroundColor: theme.palette.mode === 'dark'
                                ? 'rgba(99,102,241,0.18)'
                                : 'rgba(18,119,202,0.12)',
                        },
                    },
                },
                toolbarContainer: {
                    padding: '12px 16px',
                    gap: '8px',
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    '& .MuiButton-root': {
                        textTransform: 'none' as const,
                        fontWeight: 600,
                        fontSize: '0.8rem',
                    },
                },
                footerContainer: {
                    borderTop: `1px solid ${theme.palette.divider}`,
                    minHeight: 'auto',
                    overflow: 'hidden',
                },
                filterForm: {
                    gap: '8px',
                    '& .MuiFormControl-root': {
                        minWidth: 120,
                    },
                },
                panelContent: {
                    '& .MuiDataGrid-filterForm': {
                        gap: '12px',
                    },
                },
                menuIcon: {
                    color: theme.palette.primary.main,
                },
                sortIcon: {
                    color: theme.palette.primary.main,
                },
            }
        } as any,
    };
};
