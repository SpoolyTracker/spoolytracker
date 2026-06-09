import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    Typography,
} from '@mui/material';
import { Box as SpoolIcon, Copy, Link as LinkIcon, Plus, Radio, Zap } from 'lucide-react';
import { api } from '../api';
import type { NFCTagEvent } from '../types/nfc';
import { isTigerTag, parseRawTigerTag, type TigerTagData } from '../utils/tigerTagParser';

interface TigerTagModalProps {
    open: boolean;
    onClose: () => void;
    tagData: NFCTagEvent | null;
}

export default function TigerTagModal({ open, onClose, tagData }: TigerTagModalProps) {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [cloneLoading, setCloneLoading] = useState(false);
    const [existingSpool, setExistingSpool] = useState<any>(null);
    const [parsedTigerData, setParsedTigerData] = useState<TigerTagData | null>(null);
    const [enrichedData, setEnrichedData] = useState<any>(null);
    const [isTiger, setIsTiger] = useState(false);
    const [bambuResolution, setBambuResolution] = useState<any>(null);
    const isBambu = tagData?.source === 'bambu' && Boolean(tagData?.bambu);

    useEffect(() => {
        if (open && tagData?.uid) {
            void checkTag();
        } else {
            setExistingSpool(null);
            setParsedTigerData(null);
            setEnrichedData(null);
            setIsTiger(false);
            setBambuResolution(null);
            setLoading(false);
            setCloneLoading(false);
        }
    }, [open, tagData]);

    const checkTag = async () => {
        if (!tagData?.uid) return;
        setLoading(true);

        try {
            const spool = await findExistingSpoolByTag(tagData);
            if (spool) {
                setExistingSpool(spool);
                return;
            }

            if (tagData.source === 'bambu' && tagData.bambu) {
                setBambuResolution(await resolveBambuCatalog(tagData.bambu));
                return;
            }

            if (tagData.data && Array.isArray(tagData.data) && isTigerTag(tagData.data)) {
                setIsTiger(true);
                const parsed = parseRawTigerTag(tagData.data);
                setParsedTigerData(parsed);

                if (parsed) {
                    try {
                        setEnrichedData(await api.resolveTigerTag({
                            brandId: parsed.brandId,
                            materialId: parsed.materialId,
                            typeId: parsed.typeId,
                        }));
                    } catch (error) {
                        console.warn('Resolution failed', error);
                    }
                }
            }
        } catch (error) {
            console.error('Error checking tag:', error);
        } finally {
            setLoading(false);
        }
    };

    const findExistingSpoolByTag = async (tag: NFCTagEvent) => {
        for (const candidate of getTagLookupCandidates(tag)) {
            try {
                const spool = await api.getFilamentByTag(candidate);
                if (spool) return spool;
            } catch {
                // Try the next common UID representation.
            }
        }
        return null;
    };

    const getTagLookupCandidates = (tag: NFCTagEvent) => {
        const values = [tag.uid, tag.bambu?.tagId, tag.bambu?.uidHex].filter(Boolean) as string[];
        const candidates = new Set<string>();

        for (const value of values) {
            const clean = value.replace(/[^0-9a-f]/gi, '').toUpperCase();
            if (!clean) continue;

            candidates.add(value);
            candidates.add(clean);
            candidates.add(formatUid(clean));

            const reversed = reverseHexBytes(clean);
            if (reversed) {
                candidates.add(reversed);
                candidates.add(formatUid(reversed));
            }
        }

        return [...candidates];
    };

    const formatUid = (hex: string) => {
        const clean = hex.replace(/[^0-9a-f]/gi, '').toUpperCase();
        return clean.match(/.{1,2}/g)?.join(':') || clean;
    };

    const reverseHexBytes = (hex: string) => {
        const bytes = hex.replace(/[^0-9a-f]/gi, '').toUpperCase().match(/.{1,2}/g);
        return bytes ? bytes.reverse().join('') : '';
    };

    const normalizeName = (value?: string) => String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

    const mapBambuMaterial = (materialId?: string, filamentType?: string, detailedFilamentType?: string) => {
        const source = `${materialId || ''} ${filamentType || ''} ${detailedFilamentType || ''}`.toUpperCase();
        if (source.includes('PETG')) return 'PETG';
        if (source.includes('ABS')) return 'ABS';
        if (source.includes('ASA')) return 'ASA';
        if (source.includes('TPU')) return 'TPU';
        if (source.includes('PA-CF')) return 'PA-CF';
        if (source.includes('PET-CF')) return 'PET-CF';
        if (source.includes('PLA')) return 'PLA';

        const prefix = (materialId || '').toUpperCase();
        if (prefix.startsWith('GFA')) return 'PLA';
        if (prefix.startsWith('GFB')) return 'ABS';
        if (prefix.startsWith('GFC')) return 'PETG';
        if (prefix.startsWith('GFN')) return 'PA-CF';
        if (prefix.startsWith('GFS')) return 'TPU';
        if (prefix.startsWith('GFT')) return 'ASA';
        if (prefix.startsWith('GFV')) return 'PET-CF';
        return '';
    };

    const resolveBambuCatalog = async (bambuData: NonNullable<NFCTagEvent['bambu']>) => {
        const recognizedMaterial = mapBambuMaterial(
            bambuData.materialId,
            bambuData.filamentType,
            bambuData.detailedFilamentType
        );
        const materialName = normalizeName(recognizedMaterial);
        const detailedName = normalizeName(bambuData.detailedFilamentType || bambuData.filamentType);
        const typeNameOnly = materialName ? detailedName.replace(new RegExp(`\\b${materialName}\\b`, 'g'), '').trim() : detailedName;

        try {
            const [brands, materials, types] = await Promise.all([
                api.getBrands(),
                api.getMaterials(),
                api.getTypes(),
            ]);

            return {
                brand: brands.find((brand: any) => normalizeName(brand.name).includes('bambu')),
                material: materialName ? materials.find((material: any) => normalizeName(material.name) === materialName) : null,
                type: typeNameOnly ? types.find((type: any) => normalizeName(type.name) === typeNameOnly) : null,
                recognizedMaterial,
                typeNameOnly,
            };
        } catch (error) {
            console.warn('Bambu catalog resolution failed', error);
            return { recognizedMaterial, typeNameOnly };
        }
    };

    const firstBambuColor = (colorHex?: string) => {
        if (!colorHex) return '';
        return colorHex.split('/')[0].trim();
    };

    const formatWeight = (value?: number | string | null) => {
        const n = Number(value);
        return Number.isFinite(n) ? `${Math.round(n)}g` : '-';
    };

    const existingSpoolTypes = () => {
        if (!existingSpool) return '';
        const types = existingSpool.types?.map((type: any) => type.name).filter(Boolean);
        if (types?.length) return types.join(', ');
        return existingSpool.type?.name || '';
    };

    const getSpoolTitle = () => {
        if (!existingSpool) return '';
        return [
            existingSpool.brand?.name,
            existingSpool.material?.name,
            existingSpoolTypes(),
            existingSpool.colorName,
        ].filter(Boolean).join(' - ');
    };

    const appendBambuCreateParams = (params: URLSearchParams) => {
        if (tagData?.source !== 'bambu' || !tagData.bambu) return;
        const bambu = tagData.bambu;

        if (bambuResolution?.brand?.id) params.append('initialBrandId', bambuResolution.brand.id.toString());
        if (bambuResolution?.material?.id) params.append('initialMaterialId', bambuResolution.material.id.toString());
        if (bambuResolution?.type?.id) params.append('initialTypeId', bambuResolution.type.id.toString());
        else if (bambuResolution?.typeNameOnly) params.append('initialTypeName', bambuResolution.typeNameOnly);

        if (bambu.colorHex) params.append('initialColor', firstBambuColor(bambu.colorHex));
        if (bambu.nozzleTempMin) params.append('initialNozzleMin', bambu.nozzleTempMin.toString());
        if (bambu.nozzleTempMax) params.append('initialNozzleMax', bambu.nozzleTempMax.toString());
        if (bambu.bedTemp) {
            params.append('initialBedMin', bambu.bedTemp.toString());
            params.append('initialBedMax', bambu.bedTemp.toString());
        }
        if (bambu.spoolWeight) {
            params.append('initialWeight', bambu.spoolWeight.toString());
            params.append('initialWeightRemaining', bambu.spoolWeight.toString());
        }
        if (bambu.dryingTemp) params.append('initialDryTemp', bambu.dryingTemp.toString());
        if (bambu.dryingTime) params.append('initialDryTime', bambu.dryingTime.toString());
        if (bambu.filamentDiameter) params.append('initialDiameter', bambu.filamentDiameter.toString());
        if (bambu.materialId) params.append('bambuMaterialId', bambu.materialId);
        if (bambu.variantId) params.append('bambuVariantId', bambu.variantId);
    };

    const appendTigerCreateParams = (params: URLSearchParams) => {
        if (!parsedTigerData) return;

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

        if (parsedTigerData.brandId) params.append('tigerBrandId', parsedTigerData.brandId.toString());
        if (parsedTigerData.materialId) params.append('tigerMaterialId', parsedTigerData.materialId.toString());
        if (parsedTigerData.typeId) params.append('tigerTypeId', parsedTigerData.typeId.toString());
        if (parsedTigerData.colorHex) params.append('initialColor', parsedTigerData.colorHex);
        if (parsedTigerData.nozzleTempMin) params.append('initialNozzleMin', parsedTigerData.nozzleTempMin.toString());
        if (parsedTigerData.nozzleTempMax) params.append('initialNozzleMax', parsedTigerData.nozzleTempMax.toString());
        if (parsedTigerData.bedTempMin) params.append('initialBedMin', parsedTigerData.bedTempMin.toString());
        if (parsedTigerData.bedTempMax) params.append('initialBedMax', parsedTigerData.bedTempMax.toString());
    };

    const handleCreate = () => {
        onClose();
        const params = new URLSearchParams();
        params.append('action', 'create');
        params.append('nfcTagId', tagData?.uid || '');
        appendBambuCreateParams(params);
        appendTigerCreateParams(params);
        navigate(`/inventory?${params.toString()}`);
    };

    const handleAssociate = () => {
        onClose();
        navigate(`/inventory?associateTag=${tagData?.uid}`);
    };

    const handleViewSpool = () => {
        onClose();
        if (existingSpool) navigate(`/inventory?viewId=${existingSpool.id}`);
    };

    const handleAddToGroup = async () => {
        if (!existingSpool?.id) return;
        setCloneLoading(true);
        try {
            const clone = await api.cloneFilament(existingSpool.id);
            onClose();
            navigate(`/inventory?viewId=${clone.id}`);
        } catch (error) {
            console.error('Failed to add spool to group', error);
        } finally {
            setCloneLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {isTiger ? <Radio color="#ec4899" /> : <Zap color={isBambu ? '#00ae42' : '#6366f1'} />}
                {loading ? t('nfcModal.reading') : (
                    existingSpool
                        ? t('nfcModal.spoolFound')
                        : isBambu
                            ? t('nfcModal.bambuDetected')
                            : isTiger
                                ? t('nfcModal.tigerDetected')
                                : t('nfcModal.nfcDetected')
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
                            <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2, border: '1px dashed', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box>
                                    <Typography variant="overline" color="text.secondary">{t('nfcModal.tagUid')}</Typography>
                                    <Typography variant="h5" sx={{ fontFamily: 'monospace', letterSpacing: 1 }}>
                                        {tagData?.uid || t('nfcModal.unknown')}
                                    </Typography>
                                    {isBambu && tagData?.bambu?.uidHex && (
                                        <Typography variant="caption" color="text.secondary">
                                            {t('nfcModal.uidHex')}: {tagData.bambu.uidHex}
                                        </Typography>
                                    )}
                                </Box>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Chip
                                        label={isBambu ? 'Bambu Lab' : (isTiger ? 'TigerTag' : t('nfcModal.nfcType2'))}
                                        size="small"
                                        color={isTiger ? 'secondary' : (isBambu ? 'success' : 'default')}
                                        variant="outlined"
                                    />
                                </Stack>
                            </Box>

                            {existingSpool && (
                                <Alert severity="success" icon={<SpoolIcon />}>
                                    <Typography variant="subtitle1" fontWeight="bold">
                                        {getSpoolTitle() || t('nfcModal.spool')}
                                    </Typography>
                                    <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 1 }}>
                                        <Chip size="small" label={`${t('nfcModal.weight')}: ${formatWeight(existingSpool.weightRemaining)} / ${formatWeight(existingSpool.weightInitial)}`} />
                                        {existingSpool.spoolReference && <Chip size="small" label={`${t('nfcModal.reference')}: ${existingSpool.spoolReference}`} />}
                                        {existingSpool.nfcTagId && <Chip size="small" label={`${t('nfcModal.linkedTag')}: ${existingSpool.nfcTagId}`} />}
                                        {existingSpool.nozzleTempMin && <Chip size="small" label={`${t('nfcModal.nozzle')}: ${existingSpool.nozzleTempMin}-${existingSpool.nozzleTempMax || existingSpool.nozzleTempMin} C`} />}
                                        {(existingSpool.bedTempMin || existingSpool.bedTemp) && <Chip size="small" label={`${t('nfcModal.bed')}: ${existingSpool.bedTempMin || existingSpool.bedTemp}-${existingSpool.bedTempMax || existingSpool.bedTempMin || existingSpool.bedTemp} C`} />}
                                        {existingSpool.dryTemp && <Chip size="small" label={`${t('nfcModal.drying')}: ${existingSpool.dryTemp} C / ${existingSpool.dryTime || '-'}h`} />}
                                        {existingSpool.diameterMm && <Chip size="small" label={`${t('nfcModal.diameter')}: ${existingSpool.diameterMm}mm`} />}
                                    </Stack>
                                    {isBambu && tagData?.bambu && (
                                        <Box sx={{ mt: 2 }}>
                                            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                                {t('nfcModal.bambuRfidDetails')}
                                            </Typography>
                                            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                                                {tagData.bambu.materialId && <Chip size="small" variant="outlined" label={`${t('nfcModal.materialId')}: ${tagData.bambu.materialId}`} />}
                                                {tagData.bambu.variantId && <Chip size="small" variant="outlined" label={`${t('nfcModal.variantId')}: ${tagData.bambu.variantId}`} />}
                                                {tagData.bambu.detailedFilamentType && <Chip size="small" variant="outlined" label={tagData.bambu.detailedFilamentType} />}
                                                {tagData.bambu.colorHex && <Chip size="small" variant="outlined" label={`${t('nfcModal.rfidColor')}: ${tagData.bambu.colorHex}`} />}
                                                {tagData.bambu.trayUid && <Chip size="small" variant="outlined" label={`${t('nfcModal.trayUid')}: ${tagData.bambu.trayUid}`} />}
                                                {tagData.bambu.productionDate && <Chip size="small" variant="outlined" label={`${t('nfcModal.productionDate')}: ${tagData.bambu.productionDate}`} />}
                                            </Stack>
                                        </Box>
                                    )}
                                </Alert>
                            )}

                            {!existingSpool && isTiger && parsedTigerData && (
                                <Box>
                                    <Typography variant="h6" gutterBottom>{t('nfcModal.tigerInfo')}</Typography>
                                    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                                        <Chip label={enrichedData?.brand?.mappedName || enrichedData?.brand?.tigerName || `${t('nfcModal.brandId')} ${parsedTigerData.brandId}`} />
                                        <Chip label={enrichedData?.material?.mappedName || enrichedData?.material?.tigerName || `${t('nfcModal.materialId')} ${parsedTigerData.materialId}`} />
                                    </Stack>
                                    <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'center' }}>
                                        {parsedTigerData.colorHex && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: parsedTigerData.colorHex, border: '1px solid #ddd' }} />
                                                <Typography variant="body2">{parsedTigerData.colorHex}</Typography>
                                            </Box>
                                        )}
                                        {parsedTigerData.nozzleTempMin && (
                                            <Chip size="small" label={`${t('nfcModal.nozzle')}: ${parsedTigerData.nozzleTempMin}-${parsedTigerData.nozzleTempMax} C`} variant="outlined" />
                                        )}
                                        {parsedTigerData.bedTempMin && (
                                            <Chip size="small" label={`${t('nfcModal.bed')}: ${parsedTigerData.bedTempMin}-${parsedTigerData.bedTempMax} C`} variant="outlined" />
                                        )}
                                    </Stack>
                                    <Typography variant="body2" color="text.secondary">
                                        {t('nfcModal.tigerCreateHint')}
                                    </Typography>
                                </Box>
                            )}

                            {!existingSpool && isBambu && tagData?.bambu && (
                                <Box>
                                    <Typography variant="h6" gutterBottom>{t('nfcModal.bambuInfo')}</Typography>
                                    <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
                                        <Chip label={bambuResolution?.brand?.name || 'Bambu Lab'} />
                                        <Chip label={bambuResolution?.material?.name || bambuResolution?.recognizedMaterial || tagData.bambu.materialId || t('nfcModal.material')} />
                                        {(bambuResolution?.type?.name || tagData.bambu.detailedFilamentType || tagData.bambu.filamentType) && (
                                            <Chip label={bambuResolution?.type?.name || tagData.bambu.detailedFilamentType || tagData.bambu.filamentType} />
                                        )}
                                    </Stack>
                                    <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
                                        {tagData.bambu.colorHex && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: firstBambuColor(tagData.bambu.colorHex), border: '1px solid #ddd' }} />
                                                <Typography variant="body2">{tagData.bambu.colorHex}</Typography>
                                            </Box>
                                        )}
                                        {tagData.bambu.materialId && <Chip size="small" label={`${t('nfcModal.materialId')}: ${tagData.bambu.materialId}`} variant="outlined" />}
                                        {tagData.bambu.variantId && <Chip size="small" label={`${t('nfcModal.variantId')}: ${tagData.bambu.variantId}`} variant="outlined" />}
                                        {tagData.bambu.spoolWeight && <Chip size="small" label={`${t('nfcModal.weight')}: ${tagData.bambu.spoolWeight}g`} variant="outlined" />}
                                        {tagData.bambu.filamentDiameter && <Chip size="small" label={`${t('nfcModal.diameter')}: ${tagData.bambu.filamentDiameter}mm`} variant="outlined" />}
                                        {tagData.bambu.nozzleTempMin && <Chip size="small" label={`${t('nfcModal.nozzle')}: ${tagData.bambu.nozzleTempMin}-${tagData.bambu.nozzleTempMax} C`} variant="outlined" />}
                                        {tagData.bambu.bedTemp && <Chip size="small" label={`${t('nfcModal.bed')}: ${tagData.bambu.bedTemp} C`} variant="outlined" />}
                                        {tagData.bambu.dryingTemp && <Chip size="small" label={`${t('nfcModal.drying')}: ${tagData.bambu.dryingTemp} C / ${tagData.bambu.dryingTime || '-'}h`} variant="outlined" />}
                                        {tagData.bambu.trayUid && <Chip size="small" label={`${t('nfcModal.trayUid')}: ${tagData.bambu.trayUid}`} variant="outlined" />}
                                        {tagData.bambu.productionDate && <Chip size="small" label={`${t('nfcModal.productionDate')}: ${tagData.bambu.productionDate}`} variant="outlined" />}
                                    </Stack>
                                    <Typography variant="body2" color="text.secondary">
                                        {t('nfcModal.bambuCreateHint')}
                                    </Typography>
                                </Box>
                            )}

                            {!existingSpool && !isTiger && !isBambu && (
                                <Typography variant="body1" color="text.secondary">
                                    {t('nfcModal.genericHint')}
                                </Typography>
                            )}
                        </>
                    )}
                </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose} color="inherit">{t('common.close')}</Button>

                {existingSpool ? (
                    <>
                        <Button variant="outlined" onClick={handleAddToGroup} startIcon={<Copy size={18} />} disabled={cloneLoading}>
                            {cloneLoading ? t('nfcModal.addingToGroup') : t('nfcModal.addToGroup')}
                        </Button>
                        <Button variant="contained" onClick={handleViewSpool} startIcon={<SpoolIcon size={18} />}>
                            {t('nfcModal.viewSpool')}
                        </Button>
                    </>
                ) : (
                    <>
                        <Button variant="outlined" onClick={handleAssociate} startIcon={<LinkIcon size={18} />}>
                            {t('nfcModal.linkExisting')}
                        </Button>
                        <Button variant="contained" onClick={handleCreate} startIcon={<Plus size={18} />}>
                            {t('nfcModal.createSpool')}
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
}
