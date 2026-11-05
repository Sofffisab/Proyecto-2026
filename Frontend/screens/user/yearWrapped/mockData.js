// YearWrapped/frontend/mockData.js
// Datos de ejemplo para ver el Wrapped sin backend (prop `data` o `useMock`).

export const mockWrapped = {
  year: 2026,
  firstName: 'Sofi',
  totalPoints: 12840,
  friendsMade: 9,
  achievementsUnlocked: 14,
  gymDays: 148,
  goalsCompleted: {
    count: 5,
    items: [
      { id: 'g1', label: 'Fuerza · Subir 100 kg', difficulty: 'HARD', completedAt: '2026-09-02T12:00:00.000Z' },
      { id: 'g2', label: 'Constancia · Mantener 4 días por semana', difficulty: 'MEDIUM', completedAt: '2026-07-11T12:00:00.000Z' },
      { id: 'g3', label: 'Peso · Bajar 5 kg', difficulty: 'MEDIUM', completedAt: '2026-05-20T12:00:00.000Z' },
      { id: 'g4', label: 'Resistencia · Subir 30 min', difficulty: 'EASY', completedAt: '2026-04-01T12:00:00.000Z' },
      { id: 'g5', label: 'Movilidad · Mantener', difficulty: 'EASY', completedAt: '2026-03-01T12:00:00.000Z' },
    ],
  },
  machinesUsed: 17,
  totalMachines: 24,
  topMachine: { name: 'Prensa de piernas', count: 63 },
  mostIntenseDay: { date: '2026-08-14', minutes: 142, machines: 9, points: 310 },
  distinctRoutines: 6,
  gift: { percent: 50, concept: 'cuota de enero', validUntil: '2027-01-31' },
};
