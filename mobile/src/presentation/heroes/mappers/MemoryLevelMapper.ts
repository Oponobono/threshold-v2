import type { MemoryLevel } from '../../../domain/knowledge/types';

export class MemoryLevelMapper {
  static toColor(level: MemoryLevel): string {
    const colors: Record<MemoryLevel, string> = {
      excellent: '#34C759',
      good: '#30D158',
      recovering: '#FF9500',
      critical: '#FF2D55',
    };
    return colors[level];
  }
}
