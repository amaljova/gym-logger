import { useRef, useState, useEffect, type ReactNode, type CSSProperties } from 'react';

export interface DragHandleProps {
  onPointerDown: (e: React.PointerEvent) => void;
  style: CSSProperties;
}

interface Item { id: string }

interface SortableListProps<T extends Item> {
  items: T[];
  onReorder: (orderedIds: string[]) => void;
  renderItem: (item: T, opts: { dragging: boolean; handleProps: DragHandleProps }) => ReactNode;
  gap?: number;
}

/**
 * Pointer-event based reorderable list that works with both touch and mouse
 * (HTML5 drag-and-drop does not work on touch devices). Attach `handleProps`
 * to a dedicated drag handle inside each item.
 *
 * When not dragging it renders straight from `items`, so live data changes
 * (e.g. toggling a field) are reflected immediately. A local id ordering is
 * only kept for the duration of a drag.
 */
export default function SortableList<T extends Item>({ items, onReorder, renderItem, gap = 10 }: SortableListProps<T>) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragOrderRef = useRef<string[] | null>(null);

  // Keep the latest onReorder callback without re-subscribing listeners.
  const onReorderRef = useRef(onReorder);
  useEffect(() => { onReorderRef.current = onReorder; }, [onReorder]);

  // While dragging, render the local ordering mapped to the freshest item data;
  // otherwise render the live `items` directly so external updates show at once.
  const display: T[] = draggingId && dragOrder
    ? (dragOrder.map(id => items.find(i => i.id === id)).filter(Boolean) as T[])
    : items;

  useEffect(() => {
    if (!draggingId) return;

    const move = (e: PointerEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      const cur = dragOrderRef.current;
      if (!container || !cur) return;
      const fromIndex = cur.indexOf(draggingId);
      if (fromIndex === -1) return;

      const els = Array.from(container.children) as HTMLElement[];
      let overIndex = -1;
      for (let i = 0; i < els.length; i++) {
        const r = els[i].getBoundingClientRect();
        if (e.clientY >= r.top && e.clientY <= r.bottom) { overIndex = i; break; }
      }
      if (overIndex === -1 || overIndex === fromIndex) return;

      const next = cur.slice();
      const [moved] = next.splice(fromIndex, 1);
      next.splice(overIndex, 0, moved);
      dragOrderRef.current = next;
      setDragOrder(next);
    };

    const up = () => {
      const ids = dragOrderRef.current;
      dragOrderRef.current = null;
      setDraggingId(null);
      setDragOrder(null);
      if (ids) onReorderRef.current(ids);
    };

    document.addEventListener('pointermove', move, { passive: false });
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
    };
  }, [draggingId]);

  const makeHandleProps = (id: string): DragHandleProps => ({
    onPointerDown: (e) => {
      e.preventDefault();
      e.stopPropagation();
      const ids = items.map(i => i.id);
      dragOrderRef.current = ids;
      setDragOrder(ids);
      setDraggingId(id);
    },
    style: { touchAction: 'none', cursor: 'grab' },
  });

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: `${gap}px` }}>
      {display.map(item => renderItem(item, { dragging: draggingId === item.id, handleProps: makeHandleProps(item.id) }))}
    </div>
  );
}
