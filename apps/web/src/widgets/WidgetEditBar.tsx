import { Box, Button, Chip, Menu, MenuItem } from '@mui/material';
import { Check, RotateCcw, Settings2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { WidgetState } from './widget-layout';

interface WidgetEditBarProps {
  items: WidgetState[];
  isEditing: boolean;
  hasHidden: boolean;
  setEditing: (v: boolean) => void;
  reset: () => void;
  toggleHidden: (id: string) => void;
  titleFor?: (id: string) => ReactNode;
}

export default function WidgetEditBar({
  items, isEditing, hasHidden, setEditing, reset, toggleHidden, titleFor,
}: WidgetEditBarProps) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const hidden = items.filter((i) => i.hidden);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {isEditing && hasHidden && (
        <>
          <Chip
            label={`Widgets masqués (${hidden.length})`}
            size="small"
            onClick={(e) => setAnchor(e.currentTarget)}
            variant="outlined"
          />
          <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
            {hidden.map((h) => (
              <MenuItem
                key={h.id}
                onClick={() => { toggleHidden(h.id); setAnchor(null); }}
              >
                Réafficher : {titleFor?.(h.id) ?? h.id}
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
      {isEditing && (
        <Button size="small" color="inherit" startIcon={<RotateCcw size={16} />} onClick={reset}>
          Réinitialiser
        </Button>
      )}
      <Button
        size="small"
        variant={isEditing ? 'contained' : 'outlined'}
        startIcon={isEditing ? <Check size={16} /> : <Settings2 size={16} />}
        onClick={() => setEditing(!isEditing)}
      >
        {isEditing ? 'Terminé' : 'Personnaliser'}
      </Button>
    </Box>
  );
}
