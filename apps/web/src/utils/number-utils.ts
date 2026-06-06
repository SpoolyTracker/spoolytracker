/**
 * Normalizes a numeric input string by:
 * 1. Replacing commas with dots.
 * 2. Removing any non-numeric and non-dot characters.
 * 3. Ensuring only one dot exists.
 */
export const normalizeNumericInput = (value: string): string => {
    // Replace comma with dot
    let normalized = value.replace(',', '.');
    // Allow only numbers and one dot
    normalized = normalized.replace(/[^0-9.]/g, '');
    const parts = normalized.split('.');
    if (parts.length > 2) {
        normalized = parts[0] + '.' + parts.slice(1).join('');
    }
    return normalized;
};

/**
 * Safely converts a value to a number, returning 0 if invalid.
 */
export const safeParseFloat = (value: any): number => {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    const parsed = parseFloat(String(value).replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
};
