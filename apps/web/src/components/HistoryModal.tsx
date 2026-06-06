import ConsumptionModal from './ConsumptionModal';
import { api } from '../api';
import type { Filament } from '../api';
import { useEffect, useState } from 'react';

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    filamentId: number;
    aiHighlightDate?: string | null;
}

export default function HistoryModal({ isOpen, onClose, filamentId, aiHighlightDate }: HistoryModalProps) {
    const [filament, setFilament] = useState<Filament | null>(null);

    useEffect(() => {
        if (isOpen && filamentId) {
            // Fetch filament details if needed, or we rely on the ID being passed to proper consumption modal
            // Ideally we'd pass the full filament object to avoid refetching, but the interface asked for ID
            // For now, let's just render the Consumption Modal in "history" mode.
            // If we need data we might fetch it:
            api.get(filamentId).then(setFilament).catch(console.error);
        }
    }, [isOpen, filamentId]);

    // If we don't have filament details yet, we can render a loading state or just pass what we know (nothing)
    // The ConsumptionModal needs some props for display (brand/name) which we might not have if only ID is passed.
    // However, looking at usage in InventoryPage, it sets 'consumptionFilament' which IS a full object.
    // For setHistoryFilament, it ALSO passes the full object 'f' to set state, but the component Prop only takes ID?
    // Let's check InventoryPage again.
    // <HistoryModal isOpen={!!historyFilament} onClose={() => setHistoryFilament(null)} filamentId={historyFilament.id} />
    // It only passes ID. So we DO need to fetch, or update InventoryPage to pass the full object.
    // Updating this to fetch is safer for now.

    if (!filament) return null;

    return (
        <ConsumptionModal
            isOpen={isOpen}
            onClose={onClose}
            filamentId={filamentId}
            filamentColor={filament.color}
            filamentColors={filament.colors}
            brandName={filament.brand?.name}
            typeName={filament.type?.name}
            weightRemaining={filament.weightRemaining}
            initialTab="history"
            aiHighlightDate={aiHighlightDate}
        />
    );
}
