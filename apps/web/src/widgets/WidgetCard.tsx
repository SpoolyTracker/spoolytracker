import { Box, Card, CardContent, IconButton, Tooltip, Typography } from '@mui/material';
import { Eye, GripVertical, Minus, Plus } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { MAX_SPAN, MIN_SPAN, type WidgetSize } from './widget-layout';

interface WidgetCardProps {
  title?: ReactNode;
  size: WidgetSize;
  isEditing: boolean;
  hidden?: boolean;
  bare?: boolean;
  dragHandleProps?: HTMLAttributes<HTMLElement>;
  onToggleHide?: () => void;
  onSizeChange?: (size: WidgetSize) => void;
  children: ReactNode;
}

function EditControls({
  size, dragHandleProps, onToggleHide, onSizeChange,
}: Pick<WidgetCardProps, 'size' | 'dragHandleProps' | 'onToggleHide' | 'onSizeChange'>) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box {...dragHandleProps} sx={{ cursor: 'grab', display: 'flex', color: 'text.disabled', touchAction: 'none' }} aria-label="Déplacer">
        <GripVertical size={18} />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Tooltip title="Réduire la largeur">
          <span>
            <IconButton size="small" disabled={size <= MIN_SPAN} onClick={() => onSizeChange?.(size - 1)} aria-label="Réduire la largeur">
              <Minus size={14} />
            </IconButton>
          </span>
        </Tooltip>
        <Typography variant="caption" sx={{ minWidth: 34, textAlign: 'center', fontWeight: 600 }}>
          {size}/{MAX_SPAN}
        </Typography>
        <Tooltip title="Augmenter la largeur">
          <span>
            <IconButton size="small" disabled={size >= MAX_SPAN} onClick={() => onSizeChange?.(size + 1)} aria-label="Augmenter la largeur">
              <Plus size={14} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      <Tooltip title="Masquer">
        <IconButton size="small" onClick={onToggleHide} aria-label="Masquer le widget">
          <Eye size={16} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

export default function WidgetCard({
  title, size, isEditing, bare, dragHandleProps, onToggleHide, onSizeChange, children,
}: WidgetCardProps) {
  if (bare) {
    return (
      <Box sx={{ position: 'relative', height: '100%' }}>
        {isEditing && (
          <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 6, bgcolor: 'background.paper', borderRadius: 2, boxShadow: 2, p: 0.5 }}>
            <EditControls size={size} dragHandleProps={dragHandleProps} onToggleHide={onToggleHide} onSizeChange={onSizeChange} />
          </Box>
        )}
        {children}
      </Box>
    );
  }
  return (
    <Card sx={{ height: '100%', position: 'relative', borderRadius: 4 }}>
      {(title || isEditing) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 2 }}>
          {title && (
            <Typography variant="h3" sx={{ flex: 1 }}>{title}</Typography>
          )}
          {isEditing && (
            <Box sx={{ ml: 'auto' }}>
              <EditControls size={size} dragHandleProps={dragHandleProps} onToggleHide={onToggleHide} onSizeChange={onSizeChange} />
            </Box>
          )}
        </Box>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  );
}
