import { Grid } from '@mui/material';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';
import WidgetCard from './WidgetCard';
import { sizeToSpan, type WidgetSize } from './widget-layout';

interface SortableWidgetProps {
  id: string;
  title?: ReactNode;
  size: WidgetSize;
  isEditing: boolean;
  bare?: boolean;
  onToggleHide?: () => void;
  onSizeChange?: (size: WidgetSize) => void;
  children: ReactNode;
}

export default function SortableWidget({
  id, title, size, isEditing, bare, onToggleHide, onSizeChange, children,
}: SortableWidgetProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id, disabled: !isEditing,
  });
  const span = sizeToSpan(size);

  return (
    <Grid
      ref={setNodeRef}
      size={{ xs: 12, md: span }}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1 : undefined,
      }}
    >
      <WidgetCard
        title={title}
        size={size}
        isEditing={isEditing}
        bare={bare}
        dragHandleProps={{ ...attributes, ...listeners }}
        onToggleHide={onToggleHide}
        onSizeChange={onSizeChange}
      >
        {children}
      </WidgetCard>
    </Grid>
  );
}
