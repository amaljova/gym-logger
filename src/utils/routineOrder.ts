import { db, type Routine } from '../db/db';

/** A routine appears on the Train page unless explicitly hidden. */
export function isShownOnTrain(r: Routine): boolean {
  return r.showOnTrain !== false;
}

/** Stable sort by manual order, then name. */
export function sortRoutines(routines: Routine[]): Routine[] {
  return [...routines].sort((a, b) => {
    const ao = a.order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name);
  });
}

/** Persist a new global ordering: order = index for each id in sequence. */
export async function persistRoutineOrder(ids: string[]): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.routines, async () => {
    for (let i = 0; i < ids.length; i++) {
      await db.routines.update(ids[i], { order: i, updatedAt: now });
    }
  });
}

/**
 * When only a visible subset is reordered (Train page), splice the new visible
 * sequence back into the full sorted order, leaving hidden routines in place.
 * Returns the full id ordering to persist.
 */
export function mergeVisibleOrder(allSorted: Routine[], visibleNewIds: string[]): string[] {
  const visibleSet = new Set(visibleNewIds);
  let vi = 0;
  return allSorted.map(r => (visibleSet.has(r.id) ? visibleNewIds[vi++] : r.id));
}
