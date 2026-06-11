// AIGC START
/**
 * 字段映射 localStorage 持久化
 * 按 tableId 分别存储，用于覆盖自动推断的 fieldId（预留扩展）
 */
import type { RecordFieldMapping } from '../types';

const PREFIX = 'visual-agent-field-map-v3-';

/** 读取某张表的字段映射缓存 */
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

/** 保存某张表的字段映射缓存 */
export function saveFieldMapping(
  tableId: string,
  mapping: RecordFieldMapping,
): void {
  localStorage.setItem(PREFIX + tableId, JSON.stringify(mapping));
}
// AIGC END
