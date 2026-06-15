import { Grid } from '@mui/material';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import type { ReactNode } from 'react';
import SortableWidget from './SortableWidget';
import type { WidgetSize, WidgetState } from './widget-layout';

interface WidgetGridProps {
  items: WidgetState[];
  isEditing: boolean;
  bare?: boolean;
  onReorder: (from: number, to: number) => void;
  onToggleHide: (id: string) => void;
  onSizeChange: (id: string, size: WidgetSize) => void;
  renderWidget: (id: string) => ReactNode;
  titleFor?: (id: string) => ReactNode;
}

export default function WidgetGrid({
  items, isEditing, bare, onReorder, onToggleHide, onSizeChange, renderWidget, titleFor,
}: WidgetGridProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const visible = items.filter((i) => !i.hidden);
  const ids = visible.map((i) => i.id);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from !== -1 && to !== -1) onReorder(from, to);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <Grid container spacing={3}>
          {visible.map((item) => (
            <SortableWidget
              key={item.id}
              id={item.id}
              title={bare ? undefined : titleFor?.(item.id)}
              size={item.size}
              isEditing={isEditing}
              bare={bare}
              onToggleHide={() => onToggleHide(item.id)}
              onSizeChange={(size) => onSizeChange(item.id, size)}
            >
              {renderWidget(item.id)}
            </SortableWidget>
          ))}
        </Grid>
      </SortableContext>
    </DndContext>
  );
}
