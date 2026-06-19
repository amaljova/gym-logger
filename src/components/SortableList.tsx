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
 */
export default function SortableList<T extends Item>({ items, onReorder, renderItem, gap = 10 }: SortableListProps<T>) {
  const [order, setOrder] = useState<T[]>(items);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const orderRef = useRef(order);
  orderRef.current = order;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  // Re-sync from props when the list changes and we're not mid-drag.
  useEffect(() => {
    if (draggingId) return;
    setOrder(prev => {
      const same = prev.length === items.length && prev.every((p, i) => p.id === items[i].id);
      return same ? prev : items;
    });
  }, [items, draggingId]);

  // Drive the drag from document-level listeners so the finger is tracked
  // even when it leaves the handle element.
  useEffect(() => {
    if (!draggingId) return;

    const move = (e: PointerEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      const els = Array.from(container.children) as HTMLElement[];
      const cur = orderRef.current;
      const fromIndex = cur.findIndex(o => o.id === draggingId);
      if (fromIndex === -1) return;

      let overIndex = -1;
      for (let i = 0; i < els.length; i++) {
        const r = els[i].getBoundingClientRect();
        if (e.clientY >= r.top && e.clientY <= r.bottom) { overIndex = i; break; }
      }
      if (overIndex === -1 || overIndex === fromIndex) return;

      const next = cur.slice();
      const [moved] = next.splice(fromIndex, 1);
      next.splice(overIndex, 0, moved);
      setOrder(next);
    };

    const up = () => {
      setDraggingId(null);
      onReorderRef.current(orderRef.current.map(it => it.id));
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
      setDraggingId(id);
    },
    style: { touchAction: 'none', cursor: 'grab' },
  });

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: `${gap}px` }}>
      {order.map(item => renderItem(item, { dragging: draggingId === item.id, handleProps: makeHandleProps(item.id) }))}
    </div>
  );
}
