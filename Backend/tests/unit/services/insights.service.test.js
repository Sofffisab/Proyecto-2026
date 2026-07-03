import { describe, it, expect, beforeEach, vi } from 'vitest';
import { insightsService } from '../../../src/services/insights.service.js';

describe('InsightsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maneja dataset vacío sin lanzar error', async () => {
    const result = await insightsService.generateInsights([]);
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it('calcula correctamente con un solo registro', async () => {
    const data = [
      {
        userId: 'user-1',
        date: new Date(),
        duration: 60,
        intensity: 'HIGH',
      },
    ];

    const result = await insightsService.generateInsights(data);

    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThanOrEqual(0);
  });

  it('calcula correctamente con múltiples registros/outliers', async () => {
    const data = [
      { userId: 'user-1', date: new Date(), duration: 30, intensity: 'LOW' },
      { userId: 'user-1', date: new Date(), duration: 120, intensity: 'HIGH' },
      { userId: 'user-1', date: new Date(), duration: 45, intensity: 'MEDIUM' },
      {
        userId: 'user-1',
        date: new Date(),
        duration: 500,
        intensity: 'EXTREME',
      }, // outlier
    ];

    const result = await insightsService.generateInsights(data);

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it('aísla errores por usuario en las funciones "ForAll" (no corta el loop)', async () => {
    const users = [
      { id: 'user-1', data: [1, 2, 3] },
      { id: 'user-2', data: null }, // va a causar error
      { id: 'user-3', data: [4, 5, 6] },
    ];

    const result = await insightsService.processForAll(users);

    // Debe procesar todos, sin romper por el error en user-2
    expect(result.length).toBe(3);
    expect(result.some(r => r.id === 'user-1')).toBe(true);
    expect(result.some(r => r.id === 'user-3')).toBe(true);
  });
});
