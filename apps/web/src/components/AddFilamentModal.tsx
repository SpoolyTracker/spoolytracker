import { useState, useEffect, useMemo } from 'react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Grid,
    Typography,
    Box,
    IconButton,
} from '@mui/material';
import {
    Gauge,
    Package,
    Palette,
    Settings,
    ShoppingCart,
    SlidersHorizontal,
    Thermometer,
    X,
} from 'lucide-react';
import { api, FilamentOptionCategory } from '../api';
import type { Brand, FilamentType, FilamentOption, Organization, FilamentMaterial, BrandCatalogEntry, FilamentColorReference } from '../api';
import { CoreSection, CollapsibleSection } from './filament-modal/FilamentModalSection';
import { FilamentAdvancedSection } from './filament-modal/FilamentAdvancedSection';
import { FilamentColorSection } from './filament-modal/FilamentColorSection';
import { FilamentIdentitySection } from './filament-modal/FilamentIdentitySection';
import { FilamentOptionsSection } from './filament-modal/FilamentOptionsSection';
import { FilamentPurchaseSection } from './filament-modal/FilamentPurchaseSection';
import { FilamentStockSection } from './filament-modal/FilamentStockSection';
import { FilamentTechnicalSection } from './filament-modal/FilamentTechnicalSection';
import type { CustomOptionCategory, FilamentFormData } from './filament-modal/types';

const parseOptionalNumber = (value: unknown) => {
    if (value === null || value === undefined || value === '') return null;
    const normalized = String(value).trim().replace(',', '.');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
};

const normalizeConditionalTemperatureRules = (rules: any) => {
    const parsedRules = (() => {
        if (Array.isArray(rules)) return rules;
        if (typeof rules === 'string') {
            try {
                const parsed = JSON.parse(rules);
                return Array.isArray(parsed) ? parsed : [];
            } catch (_e) {
                return [];
            }
        }
        return [];
    })();

    return parsedRules
        .map(rule => ({
            speedMinMmS: parseOptionalNumber(rule?.speedMinMmS),
            speedMaxMmS: parseOptionalNumber(rule?.speedMaxMmS),
            nozzleTempMin: parseOptionalNumber(rule?.nozzleTempMin),
            nozzleTempMax: parseOptionalNumber(rule?.nozzleTempMax),
            notes: rule?.notes || '',
        }))
        .filter(rule =>
            rule.speedMinMmS !== null ||
            rule.speedMaxMmS !== null ||
            rule.nozzleTempMin !== null ||
            rule.nozzleTempMax !== null ||
            Boolean(rule.notes)
        );
};

interface AddFilamentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    brands: Brand[];
    materials: FilamentMaterial[];
    types: FilamentType[];
    options: Record<string, FilamentOption[]>;
    initialData?: any;
    isEditing?: boolean;
    brandCatalog?: BrandCatalogEntry[];
}

export default function AddFilamentModal({
    isOpen,
    onClose,
    onSuccess,
    brands = [],
    materials = [],
    types = [],
    options = {},
    initialData,
    isEditing = false,
    brandCatalog = []
}: AddFilamentModalProps) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [organizations, setOrganizations] = useState<Organization[]>([]);

    // Form State
    const [formData, setFormData] = useState<FilamentFormData>({
        brandId: '' as string | number,
        materialId: '' as string | number,
        typeIds: [] as number[],
        color: '#000000',
        colors: [] as string[],
        colorName: '',
        colorReferenceId: null,
        weightInitial: 1000 as number | string,
        weightRemaining: 1000 as number | string,
        weightUsed: 0 as number | string,
        organizationId: '',
        selectedOptions: [] as number[],
        purchaseDate: new Date().toISOString().split('T')[0],
        price: '' as number | string,
        vendor: '',
        isRefill: false,
        spoolReference: '',
        nozzleTempMin: '' as number | string,
        nozzleTempMax: '' as number | string,
        bedTempMin: '' as number | string,
        bedTempMax: '' as number | string,
        chamberTempMin: '' as number | string,
        chamberTempMax: '' as number | string,
        dryTemp: '' as number | string,
        dryTime: '' as number | string,
        printSpeedMin: '' as number | string,
        printSpeedMax: '' as number | string,
        retractionDistanceMm: '' as number | string,
        retractionSpeedMmS: '' as number | string,
        retractionZHopMm: '' as number | string,
        retractionNotes: '',
        conditionalTemperatureRules: [],
        kFactor: '' as number | string,
        maxVolumetricSpeedMm3S: '' as number | string,
        flowRatio: '' as number | string,
        densityGcm3: 1.24 as number | string,
        diameterMm: 1.75 as number | string,
        lowStockThreshold: null as number | string | null,
        lowStockThresholdType: 'GRAMS' as 'GRAMS' | 'PERCENTAGE',
        nfcTagId: '' as string | undefined,
        tigerBrandId: undefined as number | undefined,
        tigerMaterialId: undefined as number | undefined,
        tigerTypeId: undefined as number | undefined,
        quantity: 1 as number | string,
    });

    // Custom Input State
    const [customBrand, setCustomBrand] = useState('');
    const [customMaterial, setCustomMaterial] = useState('');
    const [customType, setCustomType] = useState('');
    const [addedTypes, setAddedTypes] = useState<FilamentType[]>([]);

    // Options State (for UI updates on delete)
    const [brandOptions, setBrandOptions] = useState<Brand[]>([]);
    const [materialOptions, setMaterialOptions] = useState<FilamentMaterial[]>([]);
    const [typeOptions, setTypeOptions] = useState<FilamentType[]>([]);



    const [smartSelectionEnabled, setSmartSelectionEnabled] = useState(true);

    // Unified Catalog Options
    const [catalogOptions, setCatalogOptions] = useState<BrandCatalogEntry[]>([]);
    const [colorReferences, setColorReferences] = useState<FilamentColorReference[]>([]);
    const [savingColorReference, setSavingColorReference] = useState(false);

    useEffect(() => {
        // Compute available catalog entries for the selected brand
        if (formData.brandId && brandCatalog.length > 0) {
            const entries = brandCatalog.filter(e => e.brandId === Number(formData.brandId) && e.isActive !== false);
            setCatalogOptions(entries);
        } else {
            setCatalogOptions([]);
        }
    }, [formData.brandId, brandCatalog]);

    useEffect(() => {
        let cancelled = false;

        const fetchColorReferences = async () => {
            if (!formData.brandId) {
                setColorReferences([]);
                return;
            }

            try {
                const refs = await api.getColorReferences({
                    brandId: formData.brandId,
                    materialId: formData.materialId || undefined,
                    typeId: formData.typeIds[0] || undefined,
                });
                if (!cancelled) {
                    setColorReferences(refs);
                }
            } catch (error) {
                console.error('Failed to fetch color references', error);
                if (!cancelled) setColorReferences([]);
            }
        };

        fetchColorReferences();

        return () => {
            cancelled = true;
        };
    }, [formData.brandId, formData.materialId, formData.typeIds]);

    const handleCatalogSelection = (entryId: number) => {
        const entry = catalogOptions.find(e => e.id === entryId);
        if (entry) {
            // Update form with linked Material and Type
            setFormData(prev => ({
                ...prev,
                materialId: entry.materialId,
                typeIds: [entry.typeId],
                densityGcm3: entry.density_gcm3 ?? prev.densityGcm3,
                nozzleTempMin: entry.nozzle_temp_min ?? prev.nozzleTempMin,
                nozzleTempMax: entry.nozzle_temp_max ?? prev.nozzleTempMax,
                bedTempMin: entry.bed_temp_min ?? prev.bedTempMin,
                bedTempMax: entry.bed_temp_max ?? prev.bedTempMax,
            }));
        }
    };

    // Helper to find selected catalog entry ID
    const selectedCatalogEntryId = useMemo(() => {
        if (!formData.materialId || formData.typeIds.length === 0) return '';
        const entry = catalogOptions.find(e =>
            e.materialId === Number(formData.materialId) &&
            e.typeId === formData.typeIds[0]
        );
        return entry ? entry.id : '';
    }, [formData.materialId, formData.typeIds, catalogOptions]);

    useEffect(() => {
        setBrandOptions(brands);
    }, [brands]);

    // Computed filtered options based on Brand Catalog
    useEffect(() => {
        // Materials
        if (smartSelectionEnabled && formData.brandId && brandCatalog.some(e => e.brandId === Number(formData.brandId))) {
            // If brand has catalog entries, filter materials
            const allowedMaterialIds = brandCatalog
                .filter(e => e.brandId === Number(formData.brandId))
                .map(e => e.materialId);
            const filteredParams = materials.filter(m => allowedMaterialIds.includes(m.id));
            setMaterialOptions(filteredParams);
        } else {
            // Use all materials
            setMaterialOptions(materials);
        }
    }, [materials, formData.brandId, brandCatalog, smartSelectionEnabled]);

    useEffect(() => {
        // Types
        let availableTypes = [...types, ...addedTypes];

        if (smartSelectionEnabled && formData.brandId && brandCatalog.some(e => e.brandId === Number(formData.brandId))) {
            // If brand has catalog entries, further filter by Material if selected, or just by Brand
            let allowedTypeIds: number[] = [];

            if (formData.materialId) {
                // Filter by Brand AND Material
                allowedTypeIds = brandCatalog
                    .filter(e => e.brandId === Number(formData.brandId) && e.materialId === Number(formData.materialId))
                    .map(e => e.typeId);
            } else {
                // Filter by Brand only (show all possible types for this brand)
                allowedTypeIds = brandCatalog
                    .filter(e => e.brandId === Number(formData.brandId))
                    .map(e => e.typeId);
            }
            availableTypes = availableTypes.filter(t => allowedTypeIds.includes(t.id));
        }

        availableTypes.sort((a, b) => a.name.localeCompare(b.name));
        setTypeOptions(availableTypes);
    }, [types, addedTypes, formData.brandId, formData.materialId, brandCatalog, smartSelectionEnabled]);

    const handleDeleteBrand = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (!confirm(t('common.confirmDelete') || 'Delete this item?')) return;
        try {
            await api.deleteBrand(id);
            setBrandOptions(prev => prev.filter(b => b.id !== id));
            // If selected, clear it
            if (Number(formData.brandId) === id) setFormData(prev => ({ ...prev, brandId: '' }));
        } catch (error: any) {
            console.error('Failed to delete brand', error);
            alert(error.message || 'Failed to delete');
        }
    };

    const handleDeleteMaterial = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (!confirm(t('common.confirmDelete') || 'Delete this item?')) return;
        try {
            await api.deleteMaterial(id);
            setMaterialOptions(prev => prev.filter(m => m.id !== id));
            if (Number(formData.materialId) === id) setFormData(prev => ({ ...prev, materialId: '' }));
        } catch (error: any) {
            console.error('Failed to delete material', error);
            alert(error.message || 'Failed to delete');
        }
    };

    const handleDeleteType = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (!confirm(t('common.confirmDelete') || 'Delete this item?')) return;
        try {
            await api.deleteType(id);
            setAddedTypes(prev => prev.filter(t => t.id !== id)); // If it was locally added
            // Note: If it was in 'types' prop, we can't remove it from there, but we filter 'typeOptions'.
            setTypeOptions(prev => prev.filter(t => t.id !== id));

            if (formData.typeIds.includes(id)) {
                setFormData(prev => ({ ...prev, typeIds: prev.typeIds.filter(tid => tid !== id) }));
            }
        } catch (error: any) {
            console.error('Failed to delete type', error);
            alert(error.message || 'Failed to delete');
        }
    };
    const [customOption, setCustomOption] = useState('');
    const [customOptionCategory, setCustomOptionCategory] = useState<CustomOptionCategory>(FilamentOptionCategory.FINISH);
    const [isCustomBrand, setIsCustomBrand] = useState(false);
    const [isCustomMaterial, setIsCustomMaterial] = useState(false);
    const [isCustomType, setIsCustomType] = useState(false);
    const [isAddingCustomOption, setIsAddingCustomOption] = useState(false);
    const [weightMode, setWeightMode] = useState<'remaining' | 'used'>('remaining');

    // Custom Characteristic State


    useEffect(() => {
        const fetchOrgs = async () => {
            try {
                const data = await api.getOrganizations();
                // data is UserOrganization[]
                const processedOrgs = data
                    .filter(uo => uo.hasConfirmed)
                    .map(uo => {
                        const org = uo.organization;
                        (org as any).isOverride = uo.userId !== undefined && !uo.id; // Virtual UOs have no ID from DB
                        return org;
                    });
                setOrganizations(processedOrgs);


                // Set default organization if not editing and nothing selected
                if (!isEditing && !formData.organizationId) {
                    const currentOrgId = localStorage.getItem('emulated_organization_id') || localStorage.getItem('organization_id');
                    if (currentOrgId) {
                        setFormData(prev => ({ ...prev, organizationId: currentOrgId }));
                    }
                }

            } catch (error) {
                console.error('Failed to fetch organizations', error);
            }
        };
        fetchOrgs();
    }, [isEditing]);

    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({
                ...prev,
                brandId: initialData.brand?.id || initialData.brandId || prev.brandId,
                materialId: initialData.material?.id || initialData.type?.id || initialData.materialId || prev.materialId,
                typeIds: initialData.types?.map((t: any) => t.id) ||
                    (initialData.type ? [initialData.type.id] : []) ||
                    (initialData.typeId ? [initialData.typeId] : []) ||
                    (initialData.typeName ? [types.find(t => t.name.toLowerCase() === initialData.typeName.toLowerCase())?.id].filter(id => id !== undefined) as number[] : []) ||
                    prev.typeIds,

                color: initialData.colors?.[0] || initialData.color || prev.color,
                colors: (initialData.colors && initialData.colors.length > 1) ? initialData.colors.slice(1) : (initialData.colors?.length === 1 ? [] : prev.colors),
                colorName: initialData.colorName || prev.colorName,
                colorReferenceId: initialData.colorReferenceId ?? prev.colorReferenceId,
                weightInitial: initialData.weightInitial ?? prev.weightInitial,
                weightRemaining: initialData.weightRemaining ?? prev.weightRemaining,
                weightUsed: (initialData.weightInitial !== undefined && initialData.weightRemaining !== undefined) ? (initialData.weightInitial - initialData.weightRemaining) : prev.weightUsed,
                organizationId: initialData.organizationId || prev.organizationId,
                selectedOptions: initialData.options?.map((o: any) => o.id) || prev.selectedOptions,
                purchaseDate: initialData.purchaseDate ? new Date(initialData.purchaseDate).toISOString().split('T')[0] : prev.purchaseDate,
                price: initialData.price || prev.price,
                vendor: initialData.vendor || prev.vendor,
                isRefill: initialData.isRefill !== undefined ? initialData.isRefill : prev.isRefill,

                spoolReference: initialData.spoolReference || prev.spoolReference,
                nozzleTempMin: initialData.nozzleTempMin || prev.nozzleTempMin,
                nozzleTempMax: initialData.nozzleTempMax || prev.nozzleTempMax,
                bedTempMin: initialData.bedTempMin || initialData.bedTemp || prev.bedTempMin,
                bedTempMax: initialData.bedTempMax || prev.bedTempMax,
                chamberTempMin: initialData.chamberTempMin || prev.chamberTempMin,
                chamberTempMax: initialData.chamberTempMax || prev.chamberTempMax,
                dryTemp: initialData.dryTemp || prev.dryTemp,
                dryTime: initialData.dryTime || prev.dryTime,
                printSpeedMin: initialData.printSpeedMin || prev.printSpeedMin,
                printSpeedMax: initialData.printSpeedMax || prev.printSpeedMax,
                retractionDistanceMm: initialData.retractionDistanceMm ?? prev.retractionDistanceMm,
                retractionSpeedMmS: initialData.retractionSpeedMmS ?? prev.retractionSpeedMmS,
                retractionZHopMm: initialData.retractionZHopMm ?? prev.retractionZHopMm,
                retractionNotes: initialData.retractionNotes ?? prev.retractionNotes,
                conditionalTemperatureRules: normalizeConditionalTemperatureRules(initialData.conditionalTemperatureRules),
                kFactor: initialData.kFactor || prev.kFactor,
                maxVolumetricSpeedMm3S: initialData.maxVolumetricSpeedMm3S || prev.maxVolumetricSpeedMm3S,
                flowRatio: initialData.flowRatio || prev.flowRatio,
                densityGcm3: initialData.densityGcm3 || prev.densityGcm3,
                diameterMm: initialData.diameterMm || prev.diameterMm,
                lowStockThreshold: initialData.lowStockThreshold ?? null,
                lowStockThresholdType: initialData.lowStockThresholdType || prev.lowStockThresholdType,
                nfcTagId: initialData.nfcTagId || prev.nfcTagId,
                tigerBrandId: initialData.tigerBrandId || prev.tigerBrandId,
                tigerMaterialId: initialData.tigerMaterialId || prev.tigerMaterialId,
                tigerTypeId: initialData.tigerTypeId || prev.tigerTypeId,
            }));
        }
    }, [initialData, isEditing, types]);

    // Fix: Disable smart selection if the edited spool doesn't match any catalog entry
    useEffect(() => {
        if (isEditing && initialData && brandCatalog.length > 0) {
            const bId = Number(initialData.brand?.id || initialData.brandId);
            const mId = Number(initialData.material?.id || initialData.materialId);
            // Collect all type IDs from initial data
            const tIds = new Set<number>();
            if (initialData.types) initialData.types.forEach((t: any) => tIds.add(Number(t.id)));
            if (initialData.type?.id) tIds.add(Number(initialData.type.id));
            if (initialData.typeId) tIds.add(Number(initialData.typeId));

            const hasMatch = brandCatalog.some(c =>
                c.brandId === bId &&
                c.materialId === mId &&
                tIds.has(c.typeId)
            );
            setSmartSelectionEnabled(hasMatch);
        }
    }, [isEditing, initialData, brandCatalog]);

    const handleSubmit = async () => {
        setLoading(true);
        try {
            // Handle Custom Brand/Material/Type creation if needed
            let finalBrandId: string | number = formData.brandId;
            let finalMaterialId: string | number = formData.materialId;
            let finalTypeIds: number[] = [...formData.typeIds];


            if (isCustomBrand && customBrand) {
                // 1. Check if already exists locally
                const trimmedName = customBrand.trim();
                const existing = brandOptions.find(b => b.name.toLowerCase() === trimmedName.toLowerCase());
                if (existing) {
                    finalBrandId = existing.id;
                } else {
                    try {
                        const newBrand = await api.createBrand(trimmedName);
                        finalBrandId = newBrand.id;
                    } catch (error: any) {
                        // If 409 Conflict, it exists on server. Fetch and find.
                        if (error.message?.includes('exists') || error.message?.includes('Conflict')) {
                            const currentBrands = await api.getBrands();
                            const serverExisting = currentBrands.find((b: any) => b.name.toLowerCase() === trimmedName.toLowerCase());
                            if (serverExisting) finalBrandId = serverExisting.id;
                            else {
                                console.error('Brand 409 but not found:', trimmedName, currentBrands);
                                throw error;
                            }
                        } else {
                            throw error;
                        }
                    }
                }
            }

            if (isCustomMaterial && customMaterial) {
                const trimmedName = customMaterial.trim();
                const existing = materialOptions.find(m => m.name.toLowerCase() === trimmedName.toLowerCase());
                if (existing) {
                    finalMaterialId = existing.id;
                } else {
                    try {
                        const newMaterial = await api.createMaterial(trimmedName);
                        finalMaterialId = newMaterial.id;
                    } catch (error: any) {
                        if (error.message?.includes('exists') || error.message?.includes('Conflict')) {
                            const currentMaterials = await api.getMaterials();
                            const serverExisting = currentMaterials.find((m: any) => m.name.toLowerCase() === trimmedName.toLowerCase());
                            if (serverExisting) finalMaterialId = serverExisting.id;
                            else {
                                console.error('Material 409 but not found:', trimmedName, currentMaterials);
                                throw error;
                            }
                        } else {
                            throw error;
                        }
                    }
                }
            }

            if (isCustomType && customType) {
                const trimmedName = customType.trim();
                const existing = typeOptions.find(t => t.name.toLowerCase() === trimmedName.toLowerCase());
                if (existing) {
                    // Add to selection if not present
                    if (!finalTypeIds.includes(existing.id)) finalTypeIds.push(existing.id);
                } else {
                    try {
                        const newType = await api.createType(trimmedName);
                        finalTypeIds.push(newType.id);
                    } catch (error: any) {
                        if (error.message?.includes('exists') || error.message?.includes('Conflict')) {
                            const currentTypes = await api.getTypes();
                            const serverExisting = currentTypes.find((t: any) => t.name.toLowerCase() === trimmedName.toLowerCase());
                            if (serverExisting) {
                                if (!finalTypeIds.includes(serverExisting.id)) finalTypeIds.push(serverExisting.id);
                            } else {
                                console.error('Type 409 but not found:', trimmedName, currentTypes);
                                throw error;
                            }
                        } else {
                            throw error;
                        }
                    }
                }
            }

            // Handle Custom Option creation if needed
            let finalSelectedOptions = [...formData.selectedOptions];
            if (customOption.trim()) {
                const newOption = await api.createOption(customOption.trim(), customOptionCategory);
                finalSelectedOptions.push(newOption.id);
                // Reset custom option state
                setCustomOption('');
                setCustomOptionCategory(FilamentOptionCategory.FINISH);
                setIsAddingCustomOption(false);
            }

            // Calculate weight
            let finalRemaining = formData.weightRemaining;
            if (weightMode === 'used') {
                finalRemaining = Number(formData.weightInitial) - Number(formData.weightUsed);
            }

            const payload: any = {
                ...formData,
                brandId: Number(finalBrandId),
                materialId: Number(finalMaterialId),
                typeIds: finalTypeIds,
                weightRemaining: finalRemaining,
                options: finalSelectedOptions, // API expects number[]
                colors: [formData.color, ...formData.colors],
                colorReferenceId: formData.colorReferenceId || null,
                // Sanitise helper
                purchaseDate: formData.purchaseDate ? formData.purchaseDate : null,
                price: formData.price === '' ? null : Number(formData.price),
                vendor: formData.vendor || null,
                spoolReference: formData.spoolReference || null,
                nozzleTempMin: formData.nozzleTempMin === '' ? null : Number(formData.nozzleTempMin),
                nozzleTempMax: formData.nozzleTempMax === '' ? null : Number(formData.nozzleTempMax),
                bedTempMin: formData.bedTempMin === '' ? null : Number(formData.bedTempMin),
                bedTempMax: formData.bedTempMax === '' ? null : Number(formData.bedTempMax),
                bedTemp: formData.bedTempMin === '' ? null : Number(formData.bedTempMin), // Backwards compatibility logic
                chamberTempMin: formData.chamberTempMin === '' ? null : Number(formData.chamberTempMin),
                chamberTempMax: formData.chamberTempMax === '' ? null : Number(formData.chamberTempMax),
                dryTemp: formData.dryTemp === '' ? null : Number(formData.dryTemp),
                dryTime: formData.dryTime === '' ? null : Number(formData.dryTime),
                printSpeedMin: formData.printSpeedMin === '' ? null : Number(formData.printSpeedMin),
                printSpeedMax: formData.printSpeedMax === '' ? null : Number(formData.printSpeedMax),
                retractionDistanceMm: formData.retractionDistanceMm === '' ? null : Number(formData.retractionDistanceMm),
                retractionSpeedMmS: formData.retractionSpeedMmS === '' ? null : Number(formData.retractionSpeedMmS),
                retractionZHopMm: formData.retractionZHopMm === '' ? null : Number(formData.retractionZHopMm),
                retractionNotes: formData.retractionNotes || null,
                conditionalTemperatureRules: normalizeConditionalTemperatureRules(formData.conditionalTemperatureRules),
                kFactor: formData.kFactor === '' ? null : Number(formData.kFactor),
                maxVolumetricSpeedMm3S: formData.maxVolumetricSpeedMm3S === '' ? null : Number(formData.maxVolumetricSpeedMm3S),
                flowRatio: formData.flowRatio === '' ? null : Number(formData.flowRatio),
                densityGcm3: formData.densityGcm3 === '' ? 1.24 : Number(formData.densityGcm3),
                diameterMm: formData.diameterMm === '' ? 1.75 : Number(formData.diameterMm),
                lowStockThreshold: (formData.lowStockThreshold === null || formData.lowStockThreshold === '')
                    ? null
                    : (isNaN(Number(formData.lowStockThreshold)) ? 0 : Number(formData.lowStockThreshold)),
                lowStockThresholdType: formData.lowStockThresholdType,
                nfcTagId: formData.nfcTagId || null,
                tigerBrandId: formData.tigerBrandId,
                tigerMaterialId: formData.tigerMaterialId,
                tigerTypeId: formData.tigerTypeId,
            };

            // Remove empty organizationId to avoid DB errors
            if (payload.organizationId === '') {
                delete payload.organizationId;
            } else {
                payload.organizationId = Number(payload.organizationId);
            }

            if (isEditing && initialData?.id) {
                await api.update(initialData.id, payload);
            } else {
                await api.create(payload);
            }

            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Failed to save filament', error);
            // Show specific error message if available
            alert(error.message || t('common.error') || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleApplyColorReference = (reference: FilamentColorReference | null) => {
        if (!reference) {
            setFormData(prev => ({ ...prev, colorReferenceId: null }));
            return;
        }

        const hexes = reference.hexes?.length ? reference.hexes : [reference.primaryHex];
        setFormData(prev => ({
            ...prev,
            colorReferenceId: reference.id,
            colorName: reference.name,
            color: hexes[0] || reference.primaryHex,
            colors: hexes.slice(1),
        }));
    };

    const handleSaveColorReference = async () => {
        if (!formData.brandId || !formData.colorName.trim()) return;

        const brandId = Number(formData.brandId);
        const materialId = formData.materialId ? Number(formData.materialId) : null;
        const typeId = formData.typeIds[0] || null;
        const name = formData.colorName.trim();
        const hexes = [formData.color, ...formData.colors].filter(Boolean);

        const existing = colorReferences.find(ref =>
            ref.brandId === brandId &&
            (ref.materialId || null) === materialId &&
            (ref.typeId || null) === typeId &&
            ref.name.toLowerCase() === name.toLowerCase()
        );

        if (existing) {
            handleApplyColorReference(existing);
            return;
        }

        setSavingColorReference(true);
        try {
            const created = await api.createColorReference({
                brandId,
                materialId,
                typeId,
                name,
                primaryHex: hexes[0],
                hexes,
                source: 'manual',
                isGlobal: false,
            });
            setColorReferences(prev => [...prev, created]);
            handleApplyColorReference(created);
        } catch (error: any) {
            console.error('Failed to save color reference', error);
            alert(error.message || 'Failed to save color reference');
        } finally {
            setSavingColorReference(false);
        }
    };

    const toggleOption = (id: number) => {
        setFormData(prev => ({
            ...prev,
            selectedOptions: prev.selectedOptions.includes(id)
                ? prev.selectedOptions.filter(o => o !== id)
                : [...prev.selectedOptions, id]
        }));
    };



    const selectedBrandName = brandOptions.find(b => b.id === formData.brandId)?.name || customBrand;
    const selectedMaterialName = materialOptions.find(m => m.id === formData.materialId)?.name;
    const selectedTypeNames = typeOptions
        .filter(type => formData.typeIds.includes(type.id))
        .map(type => type.name)
        .join(', ');
    const modalSummary = [
        selectedBrandName,
        selectedMaterialName,
        selectedTypeNames,
        formData.colorName,
        `${formData.weightRemaining || 0}g/${formData.weightInitial || 0}g`,
    ].filter(Boolean).join(' - ');

    return (
        <Dialog open={isOpen} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle
                component="div"
                sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 2,
                    pb: 2,
                }}
            >
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {isEditing ? t('common.edit') : t('inventory.addFilament')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                        {modalSummary || t('inventory.filamentModal.summaryFallback')}
                    </Typography>
                </Box>
                <IconButton onClick={onClose} size="small"><X /></IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ bgcolor: 'background.default' }}>
                <Grid container spacing={2.5}>
                    <Grid size={{ xs: 12 }}>
                        <CoreSection
                            icon={<Package size={18} />}
                            title={t('inventory.filamentModal.identityTitle')}
                            subtitle={t('inventory.filamentModal.identitySubtitle')}
                        >
                            <FilamentIdentitySection
                                t={t}
                                formData={formData}
                                setFormData={setFormData}
                                brandOptions={brandOptions}
                                materialOptions={materialOptions}
                                typeOptions={typeOptions}
                                catalogOptions={catalogOptions}
                                selectedCatalogEntryId={selectedCatalogEntryId}
                                smartSelectionEnabled={smartSelectionEnabled}
                                setSmartSelectionEnabled={setSmartSelectionEnabled}
                                isCustomBrand={isCustomBrand}
                                setIsCustomBrand={setIsCustomBrand}
                                customBrand={customBrand}
                                setCustomBrand={setCustomBrand}
                                isCustomMaterial={isCustomMaterial}
                                setIsCustomMaterial={setIsCustomMaterial}
                                customMaterial={customMaterial}
                                setCustomMaterial={setCustomMaterial}
                                isCustomType={isCustomType}
                                setIsCustomType={setIsCustomType}
                                customType={customType}
                                setCustomType={setCustomType}
                                setAddedTypes={setAddedTypes}
                                setLoading={setLoading}
                                handleCatalogSelection={handleCatalogSelection}
                                handleDeleteBrand={handleDeleteBrand}
                                handleDeleteMaterial={handleDeleteMaterial}
                                handleDeleteType={handleDeleteType}
                            />
                        </CoreSection>
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                        <CoreSection
                            icon={<Palette size={18} />}
                            title={t('inventory.filamentModal.colorTitle')}
                            subtitle={t('inventory.filamentModal.colorSubtitle')}
                        >
                            <FilamentColorSection
                                t={t}
                                formData={formData}
                                setFormData={setFormData}
                                colorReferences={colorReferences}
                                selectedBrandId={formData.brandId ? Number(formData.brandId) : null}
                                selectedMaterialId={formData.materialId ? Number(formData.materialId) : null}
                                selectedTypeId={formData.typeIds[0] || null}
                                onApplyColorReference={handleApplyColorReference}
                                onSaveColorReference={handleSaveColorReference}
                                savingColorReference={savingColorReference}
                            />
                        </CoreSection>
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                        <CoreSection
                            icon={<Gauge size={18} />}
                            title={t('inventory.filamentModal.stockTitle')}
                            subtitle={t('inventory.filamentModal.stockSubtitle')}
                        >
                            <FilamentStockSection
                                t={t}
                                formData={formData}
                                setFormData={setFormData}
                                isEditing={isEditing}
                                weightMode={weightMode}
                                setWeightMode={setWeightMode}
                            />
                        </CoreSection>
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                        <Box sx={{ display: 'grid', gap: 1.5 }}>
                            <CollapsibleSection
                                icon={<ShoppingCart size={18} />}
                                title={t('inventory.filamentModal.purchaseTitle')}
                                subtitle={t('inventory.filamentModal.purchaseSubtitle')}
                            >
                                <FilamentPurchaseSection t={t} formData={formData} setFormData={setFormData} />
                            </CollapsibleSection>

                            <CollapsibleSection
                                icon={<Thermometer size={18} />}
                                title={t('inventory.techSpecs')}
                                subtitle={t('inventory.filamentModal.technicalSubtitle')}
                            >
                                <FilamentTechnicalSection t={t} formData={formData} setFormData={setFormData} />
                            </CollapsibleSection>

                            <CollapsibleSection
                                icon={<SlidersHorizontal size={18} />}
                                title={t('inventory.options')}
                                subtitle={`${formData.selectedOptions.length} option(s) selectionnee(s)`}
                            >
                                <FilamentOptionsSection
                                    t={t}
                                    formData={formData}
                                    options={options}
                                    customOption={customOption}
                                    setCustomOption={setCustomOption}
                                    customOptionCategory={customOptionCategory}
                                    setCustomOptionCategory={setCustomOptionCategory}
                                    isAddingCustomOption={isAddingCustomOption}
                                    setIsAddingCustomOption={setIsAddingCustomOption}
                                    toggleOption={toggleOption}
                                />
                            </CollapsibleSection>

                            <CollapsibleSection
                                icon={<Settings size={18} />}
                                title={t('inventory.filamentModal.advancedTitle')}
                                subtitle={t('inventory.filamentModal.advancedSubtitle')}
                            >
                                <FilamentAdvancedSection
                                    t={t}
                                    formData={formData}
                                    setFormData={setFormData}
                                    organizations={organizations}
                                />
                            </CollapsibleSection>
                        </Box>
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={onClose}>{t('common.cancel')}</Button>
                <Button onClick={handleSubmit} variant="contained" disabled={loading}>
                    {loading ? t('common.loading') : (isEditing ? t('common.update') : t('common.create'))}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
