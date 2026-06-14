/**
 * Stack-aware inventory utilities. Pure functions over an InventorySlot[].
 */

import type { InventorySlot, Item } from './types';

export function addItem(slots: InventorySlot[], item: Item, qty = 1): InventorySlot[] {
  const next = slots.map((s) => ({ ...s }));
  if (item.stackable) {
    const existing = next.find((s) => s.item.id === item.id);
    if (existing) { existing.qty += qty; return next; }
  }
  next.push({ item, qty });
  return next;
}

export function removeItem(slots: InventorySlot[], itemId: string, qty = 1): InventorySlot[] {
  const next = slots
    .map((s) => (s.item.id === itemId ? { ...s, qty: s.qty - qty } : s))
    .filter((s) => s.qty > 0);
  return next;
}

export function hasItem(slots: InventorySlot[], itemId: string, qty = 1): boolean {
  return slots.some((s) => s.item.id === itemId && s.qty >= qty);
}

export function totalGold(slots: InventorySlot[]): number {
  return slots
    .filter((s) => s.item.effect.kind === 'gold')
    .reduce((acc, s) => acc + s.qty * (s.item.effect.kind === 'gold' ? s.item.effect.amount : 0), 0);
}
