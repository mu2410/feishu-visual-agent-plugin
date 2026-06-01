// AIGC START
import type { RecordFieldMapping } from '../types';

const PREFIX = 'visual-agent-field-map-v3-';

export function loadFieldMapping(tableId: string): RecordFieldMapping | null {
  try {
    const raw = localStorage.getItem(PREFIX + tableId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RecordFieldMapping;
    return {
      ...parsed,
      referenceImageFieldIds: parsed.referenceImageFieldIds ?? [],
    };
  } catch {
    return null;
  }
}

export function saveFieldMapping(
  tableId: string,
  mapping: RecordFieldMapping,
): void {
  localStorage.setItem(PREFIX + tableId, JSON.stringify(mapping));
}
// AIGC END
