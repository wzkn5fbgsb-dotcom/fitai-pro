import { defaultProfile } from '../profile.ts';
import type { UserProfile } from '../types.ts';

export function profile(over: Partial<UserProfile> = {}): UserProfile {
  const base = defaultProfile('2026-01-01T00:00:00.000Z');
  return {
    ...base,
    sex: 'male',
    age: 32,
    heightCm: 178,
    weightKg: 85,
    ...over,
    health: { ...base.health, ...(over.health ?? {}) },
  };
}
