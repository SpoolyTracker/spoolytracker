import type { ConsumptionLog, Filament } from '../../api';

export interface GroupedFilament {
  id: string;
  displayName: string;
  brand: string;
  type: string;
  weightRemaining: number;
  weightInitial: number;
  plannedWeight: number;
  virtualWeightRemaining: number;
  color: string;
  colors: string[];
}

export interface TopConsumptionGroup {
  id: string;
  displayName: string;
  brand: string;
  type: string;
  color: string;
  colors: string[];
  amount: number;
  plannedAmount: number;
  cost: number;
  plannedCost: number;
  stock: number;
}

export interface DashboardActivity {
  id: string;
  type: 'consumption' | 'creation';
  date: Date;
  amount?: number;
  filament: Filament | ConsumptionLog['filament'] | undefined;
  isPlanned?: boolean;
  notes?: string;
}
