// Shapes action item rows for the API boundary.
import { shape } from '../../shared/dto.js';

export function toActionItemDto(row) {
  const { id, content, ownerLabel, dueDate, isDone, orderIndex } = shape(row);
  return { id, content, ownerLabel, dueDate, isDone, orderIndex };
}

export function toActionItemListDto(rows) {
  return (rows ?? []).map(toActionItemDto);
}
