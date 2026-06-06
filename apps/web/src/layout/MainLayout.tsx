import { useState, useCallback, useRef } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import TigerTagModal from '../components/TigerTagModal'; // Import Modal
import type { NFCTagEvent } from '../types/nfc';
import { useNFCBridge } from '../hooks/useNFCBridge';
import { AiChatWidget } from '../components/AiChatWidget';

const drawerWidth = 260;

export default function MainLayout({ children }: { children: React.ReactNode }) {
    const theme = useTheme();
    const [drawerOpen, setDrawerOpen] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [tagData, setTagData] = useState<NFCTagEvent | null>(null);

    // Debounce Ref
    const lastScanTime = useRef<number>(0);

    const handleDrawerToggle = () => {
        setDrawerOpen(!drawerOpen);
    };

    // Global NFC Listener
    useNFCBridge(useCallback((tag: NFCTagEvent) => {
        console.log('MainLayout: Received Tag Event', tag);
        const now = Date.now();
        // Simple debounce: ignore if duplicate scan within 2 seconds
        if (now - lastScanTime.current < 2000) {
            console.log('MainLayout: Debounced');
            return;
        }
        lastScanTime.current = now;

        console.log('MainLayout: Opening Modal');
        setTagData(tag);
        setModalOpen(true);
    }, []));

    return (
        <Box sx={{ display: 'flex' }}>
            <TigerTagModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                tagData={tagData}
            />
            <AiChatWidget />

            {/* Header */}
            <Header handleDrawerToggle={handleDrawerToggle} />

            {/* Sidebar */}
            <Sidebar drawerOpen={drawerOpen} drawerToggle={handleDrawerToggle} />

            {/* Main Content */}
            <Box component="main" sx={{
                flexGrow: 1,
                p: { xs: 2, sm: 3 },
                pb: { xs: 10, sm: 12 },
                width: { md: `calc(100% - ${drawerOpen ? drawerWidth : 80}px)` },
                // marginLeft removed as requested, handled by flex container
                transition: theme.transitions.create(['width'], {
                    easing: theme.transitions.easing.sharp,
                    duration: theme.transitions.duration.enteringScreen,
                }),
                marginTop: '80px', // Header height
                borderTopLeftRadius: '12px',
                borderTopRightRadius: '12px',
                background: theme.palette.background.default,
                minHeight: 'calc(100vh - 80px)'
            }}>
                {localStorage.getItem('emulated_organization_id') && (
                    <Box sx={{
                        bgcolor: 'warning.main',
                        color: 'warning.contrastText',
                        p: 1.5,
                        mb: 2,
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: 2
                    }}>
                        <Typography variant="subtitle2" fontWeight="bold">
                            ⚠️ EMULATION MODE ACTIVE - Accessing organization ID: {localStorage.getItem('emulated_organization_id')}
                        </Typography>
                        <Button
                            size="small"
                            variant="contained"
                            color="inherit"
                            sx={{ color: 'warning.main', fontWeight: 'bold' }}
                            onClick={() => {
                                localStorage.removeItem('emulated_organization_id');
                                window.location.reload();
                            }}
                        >
                            Exit Emulation
                        </Button>
                    </Box>
                )}
                {children}
            </Box>
        </Box>
    );
}
