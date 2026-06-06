
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    CircularProgress,
    Stack,
    Chip,
    Alert
} from '@mui/material';
import { Radio, Zap, Link as LinkIcon, Plus, Box as SpoolIcon } from 'lucide-react';
import type { NFCTagEvent } from '../types/nfc';
import { parseRawTigerTag, isTigerTag, type TigerTagData } from '../utils/tigerTagParser';
import { api } from '../api';

interface TigerTagModalProps {
    open: boolean;
    onClose: () => void;
    tagData: NFCTagEvent | null;
}

export default function TigerTagModal({ open, onClose, tagData }: TigerTagModalProps) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [existingSpool, setExistingSpool] = useState<any>(null);
    const [parsedTigerData, setParsedTigerData] = useState<TigerTagData | null>(null);
    const [enrichedData, setEnrichedData] = useState<any>(null);
    const [isTiger, setIsTiger] = useState(false);

    useEffect(() => {
        if (open && tagData?.uid) {
            checkTag();
        } else {
            // Reset state on close
            setExistingSpool(null);
            setParsedTigerData(null);
            setEnrichedData(null);
            setIsTiger(false);
            setLoading(false);
        }
    }, [open, tagData]);

    const checkTag = async () => {
        if (!tagData?.uid) return;
        setLoading(true);

        try {
            // 1. Check Database for existing spool
            try {
                const spool = await api.getFilamentByTag(tagData.uid);
                if (spool) {
                    setExistingSpool(spool);
                    setLoading(false);
                    return;
                }
            } catch (e) {
                // Not found or error, continue
            }

            // 2. Parse TigerTag Data
            // Note: We need the bridge to send 'data' (raw bytes). 
            // If strictly following user request "same principles as mobile", mobile reads pages 4-39.
            // If bridge only sends UID, we can't fully parse.
            // Assuming bridge MIGHT send data in future or users want at least UID association.

            // @ts-ignore
            if (tagData.data && Array.isArray(tagData.data)) {
                // @ts-ignore
                const rawBytes = tagData.data;
                if (isTigerTag(rawBytes)) {
                    setIsTiger(true);
                    const parsed = parseRawTigerTag(rawBytes);
                    setParsedTigerData(parsed);

                    // 3. Resolve using Spooly Mappings
                    if (parsed) {
                        try {
                            const resolved = await api.resolveTigerTag({
                                brandId: parsed.brandId,
                                materialId: parsed.materialId,
                                typeId: parsed.typeId
                            });
                            setEnrichedData(resolved);
                        } catch (e) {
                            console.warn('Resolution failed', e);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error checking tag:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        onClose();
        // Navigate to Inventory with creation parameters
        const params = new URLSearchParams();
        params.append('action', 'create');
        params.append('nfcTagId', tagData?.uid || '');

        if (parsedTigerData) {
            // Prefer mapped Spooly IDs if available, otherwise fallback (which likely won't match but preserves info)
            const bId = enrichedData?.brand?.mappedId || parsedTigerData.brandId;
            const mId = enrichedData?.material?.mappedId || parsedTigerData.materialId;
            const tId = enrichedData?.type?.mappedId || parsedTigerData.typeId;

            if (bId) params.append('initialBrandId', bId.toString());
            if (mId) params.append('initialMaterialId', mId.toString());
            if (tId) params.append('initialTypeId', tId.toString());
            else {
                const tName = enrichedData?.type?.mappedName || enrichedData?.type?.tigerName;
                if (tName) params.append('initialTypeName', tName);
            }

            // Also pass Raw IDs just in case
            if (parsedTigerData.brandId) params.append('tigerBrandId', parsedTigerData.brandId.toString());
            if (parsedTigerData.materialId) params.append('tigerMaterialId', parsedTigerData.materialId.toString());
            if (parsedTigerData.typeId) params.append('tigerTypeId', parsedTigerData.typeId.toString());

            // Extra Data
            if (parsedTigerData.colorHex) params.append('initialColor', parsedTigerData.colorHex);
            if (parsedTigerData.nozzleTempMin) params.append('initialNozzleMin', parsedTigerData.nozzleTempMin.toString());
            if (parsedTigerData.nozzleTempMax) params.append('initialNozzleMax', parsedTigerData.nozzleTempMax.toString());
            if (parsedTigerData.bedTempMin) params.append('initialBedMin', parsedTigerData.bedTempMin.toString());
            if (parsedTigerData.bedTempMax) params.append('initialBedMax', parsedTigerData.bedTempMax.toString());
        }

        navigate(`/inventory?${params.toString()}`);
    };

    const handleAssociate = () => {
        onClose();
        navigate(`/inventory?associateTag=${tagData?.uid}`);
    };

    const handleViewSpool = () => {
        onClose();
        if (existingSpool) {
            navigate(`/inventory?viewId=${existingSpool.id}`);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {isTiger ? <Radio color="#ec4899" /> : <Zap color="#6366f1" />}
                {loading ? 'Reading Tag...' : (
                    existingSpool ? 'Spool Found' : (isTiger ? 'TigerTag Detected' : 'NFC Tag Detected')
                )}
            </DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>

                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <>
                            {/* UID Banner */}
                            <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2, border: '1px dashed', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box>
                                    <Typography variant="overline" color="text.secondary">Tag UID</Typography>
                                    <Typography variant="h5" sx={{ fontFamily: 'monospace', letterSpacing: 1 }}>
                                        {tagData?.uid || 'Unknown'}
                                    </Typography>
                                </Box>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Chip label={isTiger ? "TigerTag" : "NFC Typ 2"} size="small" color={isTiger ? "secondary" : "default"} variant="outlined" />
                                </Stack>
                            </Box>


                            {/* State 1: Existing Spool */}
                            {existingSpool && (
                                <Alert severity="success" icon={<SpoolIcon />}>
                                    <Typography variant="subtitle1" fontWeight="bold">
                                        {existingSpool.brand?.name} - {existingSpool.material?.name}
                                    </Typography>
                                    <Typography variant="body2">
                                        Weight: {existingSpool.weightRemaining}g / {existingSpool.weightInitial}g
                                    </Typography>
                                </Alert>
                            )}

                            {/* State 2: New TigerTag */}
                            {!existingSpool && isTiger && parsedTigerData && (
                                <Box>
                                    <Typography variant="h6" gutterBottom>TigerTag Info</Typography>
                                    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                                        <Chip label={enrichedData?.brand?.mappedName || enrichedData?.brand?.tigerName || `Brand ID ${parsedTigerData.brandId}`} />
                                        <Chip label={enrichedData?.material?.mappedName || enrichedData?.material?.tigerName || `Mat ID ${parsedTigerData.materialId}`} />
                                    </Stack>

                                    <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'center' }}>
                                        {parsedTigerData.colorHex && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: parsedTigerData.colorHex, border: '1px solid #ddd' }} />
                                                <Typography variant="body2">{parsedTigerData.colorHex}</Typography>
                                            </Box>
                                        )}
                                        {parsedTigerData.nozzleTempMin && (
                                            <Chip
                                                size="small"
                                                label={`Nozzle: ${parsedTigerData.nozzleTempMin}-${parsedTigerData.nozzleTempMax}°C`}
                                                variant="outlined"
                                            />
                                        )}
                                        {parsedTigerData.bedTempMin && (
                                            <Chip
                                                size="small"
                                                label={`Bed: ${parsedTigerData.bedTempMin}-${parsedTigerData.bedTempMax}°C`}
                                                variant="outlined"
                                            />
                                        )}
                                    </Stack>
                                    <Typography variant="body2" color="text.secondary">
                                        This tag contains manufacturing data. You can create a new spool with these details pre-filled.
                                    </Typography>
                                </Box>
                            )}

                            {/* State 3: Generic Tag */}
                            {!existingSpool && !isTiger && (
                                <Typography variant="body1" color="text.secondary">
                                    This tag is not associated with any filament in your inventory.
                                    You can link it to an existing spool or create a new one.
                                </Typography>
                            )}
                        </>
                    )}
                </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose} color="inherit">Close</Button>

                {existingSpool ? (
                    <Button variant="contained" onClick={handleViewSpool} startIcon={<SpoolIcon size={18} />}>
                        View Spool
                    </Button>
                ) : (
                    <>
                        <Button
                            variant="outlined"
                            onClick={handleAssociate}
                            startIcon={<LinkIcon size={18} />}
                        >
                            Link to Existing
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleCreate}
                            startIcon={<Plus size={18} />}
                        >
                            Create New Spool
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
}
