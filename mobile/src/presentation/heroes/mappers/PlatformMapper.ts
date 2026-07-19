interface PlatformVisual {
  readonly color: string;
  readonly icon: string;
  readonly label: string;
}

const PLATFORM_VISUAL: Record<string, PlatformVisual> = {
  platzi:   { color: '#98CA3F', icon: 'school',      label: 'Platzi' },
  udemy:    { color: '#A435F0', icon: 'book-play',   label: 'Udemy' },
  coursera: { color: '#0056D2', icon: 'certificate', label: 'Coursera' },
  youtube:  { color: '#FF0000', icon: 'youtube',     label: 'YouTube' },
  other:    { color: '#6B7280', icon: 'web',         label: 'Otro' },
};

export class PlatformMapper {
  static toVisual(platform: string | undefined): PlatformVisual | null {
    if (!platform) return null;
    return PLATFORM_VISUAL[platform.toLowerCase()] ?? PLATFORM_VISUAL['other'];
  }

  static allPlatforms(): readonly PlatformVisual[] {
    return Object.values(PLATFORM_VISUAL);
  }
}
