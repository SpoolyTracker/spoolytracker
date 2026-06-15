import { Box, Chip, List, ListItem, ListItemAvatar, ListItemText, Typography } from '@mui/material';
import { Crown } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatEuros, formatGrams, stripHex } from '../../utils/analytics-view';
import type { DepletionItem, DormantItem } from '../../types/analytics';

function ColorDot({ hex }: { hex?: string | null }) {
  return (
    <Box
      sx={{
        width: 18,
        height: 18,
        borderRadius: '50%',
        bgcolor: hex || '#cbd5e1',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.5)',
        flexShrink: 0,
      }}
    />
  );
}

export function ProLock({ locked, children }: { locked: boolean; children: ReactNode }) {
  if (!locked) return <>{children}</>;
  return (
    <Box sx={{ position: 'relative' }}>
      <Box sx={{ filter: 'blur(4px)', pointerEvents: 'none', opacity: 0.6 }}>{children}</Box>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, textAlign: 'center', p: 2 }}>
        <Crown size={28} color="#7c3aed" />
        <Typography variant="subtitle2" fontWeight={700}>Fonctionnalité Pro</Typography>
        <Typography variant="caption" color="text.secondary">Passez au plan Pro pour les prévisions IA.</Typography>
      </Box>
    </Box>
  );
}

export function RunwayStat({ days }: { days: number | null | undefined }) {
  return (
    <Box sx={{ textAlign: 'center', py: 2 }}>
      <Typography variant="h2" fontWeight={800}>{days != null ? `${days}` : '—'}</Typography>
      <Typography variant="body2" color="text.secondary">jours d'autonomie estimés</Typography>
    </Box>
  );
}

export function BudgetStat({ value }: { value: number | null | undefined }) {
  return (
    <Box sx={{ textAlign: 'center', py: 2 }}>
      <Typography variant="h2" fontWeight={800}>{value != null ? formatEuros(value) : '—'}</Typography>
      <Typography variant="body2" color="text.secondary">budget d'achat conseillé (30 j)</Typography>
    </Box>
  );
}

export function DepletionList({ items }: { items: DepletionItem[] }) {
  if (!items.length) return <Typography variant="body2" color="text.secondary">Aucune rupture prévue.</Typography>;
  return (
    <List dense>
      {items.slice(0, 8).map((it) => (
        <ListItem key={it.item_id} secondaryAction={<Chip size="small" color="warning" label={it.days_left != null ? `${Math.round(it.days_left)} j` : '—'} />}>
          <ListItemAvatar sx={{ minWidth: 32 }}><ColorDot hex={it.color_hex} /></ListItemAvatar>
          <ListItemText primary={stripHex(it.label)} secondary={it.estimated_date ? `vers le ${it.estimated_date}` : undefined} />
        </ListItem>
      ))}
    </List>
  );
}

export function DormantList({ items }: { items: DormantItem[] }) {
  if (!items.length) return <Typography variant="body2" color="text.secondary">Aucune bobine dormante.</Typography>;
  return (
    <List dense>
      {items.slice(0, 8).map((it) => (
        <ListItem key={it.item_id} secondaryAction={<Chip size="small" label={formatEuros(it.value)} />}>
          <ListItemAvatar sx={{ minWidth: 32 }}><ColorDot hex={it.color_hex} /></ListItemAvatar>
          <ListItemText primary={stripHex(it.label)} secondary={`${formatGrams(it.remaining_g)}${it.days_idle != null ? ` · inactif ${it.days_idle} j` : ''}`} />
        </ListItem>
      ))}
    </List>
  );
}
