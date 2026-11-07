// Static sample data for the ADMIN screens. Nothing here talks to the Backend:
// every screen reads from this file until it gets wired to its endpoint.

// Prizes. `current: true` = the prize being handed out right now.
export const PRIZES = [
  { id: 'z1', name: 'Toalla deportiva', stock: 12, total: 50, current: true },
  { id: 'z2', name: 'Botella térmica', stock: 3, total: 30, current: false },
  { id: 'z3', name: 'Banda elástica', stock: 0, total: 40, current: false },
];

// Gifts being shipped to members right now (removed once delivered).
export const SHIPMENTS = [
  { id: 's1', name: 'Juanita Pirula', prize: 'Toalla deportiva', date: '05/11/2026' },
  { id: 's2', name: 'Pedro', prize: 'Botella térmica', date: '06/11/2026' },
];

// People waiting for a prize that is out of stock (they keep being sent
// automatically as soon as there is stock again).
export const WAITLIST = [
  { id: 'w1', prize: 'Banda elástica', count: 4 },
  { id: 'w2', prize: 'Botella térmica', count: 1 },
];

// Reports already made and approved.
export const APPROVED_REPORTS = [
  { id: 'a1', reported: 'Juan Pirulo', by: 'Pedro', reason: 'Dejó la máquina ocupada sin usarla', date: '04/11/2026' },
  { id: 'a2', reported: 'Pedro', by: 'Juanita Pirula', reason: 'Uso indebido de un QR de máquina', date: '02/11/2026' },
];

// Members saying a previous report against them was wrongly applied.
export const REVIEW_REQUESTS = [
  { id: 'q1', name: 'Juan Pirulo', reportDate: '04/11/2026', message: 'Estaba usando la máquina, el QR no registró mi escaneo.' },
];

// Suspicious behavior (too many reports received / made).
export const SUSPICIOUS = [
  { id: 'x1', name: 'Pedro', kind: 'received', count: 6, days: 7 },
  { id: 'x2', name: 'Juanita Pirula', kind: 'made', count: 9, days: 3 },
];

// Whole-system activity log (privacy-filtered content is already left out).
// role: admin | trainer | user
export const HISTORY_LOG = [
  { id: 'l1', actor: 'Admin Laura', role: 'admin', action: 'Agregó 20 unidades al stock de “Toalla deportiva”', date: '07/11/2026 · 10:12' },
  { id: 'l2', actor: 'Marcos Gómez', role: 'trainer', action: 'Resolvió un conflicto de máquina: Prensa de piernas', date: '06/11/2026 · 18:20' },
  { id: 'l3', actor: 'Juanita Pirula', role: 'user', action: 'Completó una rutina', date: '06/11/2026 · 17:40' },
  { id: 'l4', actor: 'Admin Laura', role: 'admin', action: 'Creó una sesión nueva para lucia@gym.com', date: '05/11/2026 · 12:03' },
  { id: 'l5', actor: 'Pedro', role: 'user', action: 'Escaneó el QR de entrada', date: '05/11/2026 · 09:30' },
  { id: 'l6', actor: 'Lucía Fernández', role: 'trainer', action: 'Ayudó a un socio en Remo sentado', date: '04/11/2026 · 19:05' },
];

// Every account of the gym. `rating` only for trainers.
export const MEMBERS = [
  { id: 'u1', name: 'Juanita Pirula', email: 'juanita@gym.com', role: 'user', since: '12/03/2026', active: true },
  { id: 'u2', name: 'Juan Pirulo', email: 'juan@gym.com', role: 'user', since: '28/04/2026', active: true },
  { id: 'u3', name: 'Pedro', email: 'pedro@gym.com', role: 'user', since: '02/06/2026', active: false },
  { id: 't1', name: 'Marcos Gómez', email: 'marcos@gym.com', role: 'trainer', since: '15/01/2026', active: true, rating: 4.7 },
  { id: 't2', name: 'Lucía Fernández', email: 'lucia@gym.com', role: 'trainer', since: '20/02/2026', active: true, rating: 4.4 },
  { id: 'a1', name: 'Admin Laura', email: 'laura@gym.com', role: 'admin', since: '10/01/2026', active: true },
];

// Statistics screen.
export const STATS = {
  machineUsage: [
    { id: 'm1', name: 'Cinta de correr', percent: 82 },
    { id: 'm2', name: 'Press de banca', percent: 67 },
    { id: 'm3', name: 'Prensa de piernas', percent: 54 },
    { id: 'm4', name: 'Remo sentado', percent: 31 },
  ],
  trainers: [
    { id: 't1', name: 'Marcos Gómez', rating: 4.7, helps: 38 },
    { id: 't2', name: 'Lucía Fernández', rating: 4.4, helps: 27 },
  ],
  trainersAverage: 4.6,
  users: { activated: 148, deactivated: 12, metGoals: 91, notMetGoals: 57 },
};
