export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Give every item a unique id, keeping existing ones where they don't collide. */
export function assignIds<T extends { id?: string }>(items: T[]): (T & { id: string })[] {
  const seen = new Set<string>();
  return items.map(item => {
    const id = item.id && !seen.has(item.id) ? item.id : newId();
    seen.add(id);
    return { ...item, id };
  });
}
