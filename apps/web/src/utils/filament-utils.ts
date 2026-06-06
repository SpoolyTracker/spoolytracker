export interface Option {
    id: number;
    name: string;
    category: string;
    isCharacteristic?: boolean;
}

import type { Filament } from '../api';

// Generate the full display title for a filament
// Format: Brand Type [Characteristics...]
// Generate the full display title for a filament
// Format: Brand Material [One Characteristic]
export const getFilamentTitle = (filament: Filament | null | undefined): string => {
    if (!filament) return 'Unknown Filament';

    const brand = filament.brand?.name || 'Unknown Brand';
    const material = filament.material?.name || 'Unknown Material';
    const typeNames = filament.types?.map(t => t.name).join(' ') || '';
    const type = typeNames ? ` ${typeNames}` : ''; // Characteristic

    // Keep legacy support for options if needed?
    // For now, cleaner to just use the new specific fields as migration is done.

    if (filament.colorName) {
        return `${brand} ${material}${type} (${filament.colorName})`;
    }

    return `${brand} ${material}${type}`;
};

// Get only the functional options (not characteristics) for chips display
export const getFilamentChips = (filament: Filament | null | undefined): Option[] => {
    if (!filament || !filament.options) return [];
    return filament.options.filter(opt => !opt.isCharacteristic);
};

export interface FilamentGroup {
    key: string;
    brandName: string;
    type: string;
    color: string;
    colors: string[];
    displayName: string;
    totalWeight: number;
    items: Filament[];
}

export const groupFilaments = (filaments: Filament[]): FilamentGroup[] => {
    const groups: Record<string, FilamentGroup> = {};

    filaments.forEach(f => {
        const title = getFilamentTitle(f);
        const color = f.color || '#000000';
        const colors = f.colors ? [...f.colors].sort() : [];
        const key = `${title}-${color}-${colors.join(',')}`;

        if (!groups[key]) {
            groups[key] = {
                key,
                brandName: f.brand?.name || 'Unknown',
                type: f.type?.name || 'Unknown',
                color,
                colors,
                displayName: title,
                totalWeight: 0,
                items: []
            };
        }

        groups[key].items.push(f);
        groups[key].totalWeight += f.weightRemaining;
    });

    return Object.values(groups).sort((a, b) => a.displayName.localeCompare(b.displayName));
};

export const checkIsLowStock = (filament: Filament, organization: any): boolean => {
    // 1. Spool level override
    if (filament.lowStockThreshold !== undefined && filament.lowStockThreshold !== null) {
        if (filament.lowStockThresholdType === 'PERCENTAGE') {
            return filament.weightRemaining < (filament.weightInitial * filament.lowStockThreshold / 100);
        } else {
            return filament.weightRemaining < filament.lowStockThreshold;
        }
    }

    // 2. Organization level override
    const orgSettings = organization?.settings || {};
    if (orgSettings.lowStockThreshold !== undefined && orgSettings.lowStockThreshold !== null) {
        if (orgSettings.lowStockThresholdType === 'PERCENTAGE') {
            return filament.weightRemaining < (filament.weightInitial * orgSettings.lowStockThreshold / 100);
        } else {
            return filament.weightRemaining < orgSettings.lowStockThreshold;
        }
    }

    // 3. System Fallback (10% of initial weight, max 100g)
    const fallbackThreshold = Math.min(filament.weightInitial * 0.1, 100);
    return filament.weightRemaining < fallbackThreshold;
};
