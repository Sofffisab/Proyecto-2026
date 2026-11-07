// Static sample data for the trainer screens. Nothing here talks to the
// Backend: every screen reads from this file until it gets wired to the
// matching endpoint (noted next to each export).

// GET /gym/occupancy/live — people currently in the gym.
export const PEOPLE_IN_GYM = [
  {
    id: 'p1',
    name: 'Juanita Pirula',
    needsHelp: true, // pressed "Pedir Ayuda"
    medical: ['Asma leve', 'Lesión de rodilla derecha (2025)'],
    notes: ['Evitar sentadillas profundas.', 'Prefiere rutinas cortas.'],
    publicNotes: ['Viene los martes y jueves.', 'Está volviendo después de una pausa.'],
  },
  {
    id: 'p2',
    name: 'Juan Pirulo',
    needsHelp: false,
    medical: [],
    notes: ['Objetivo: ganar masa muscular.'],
    publicNotes: ['Nivel intermedio.'],
  },
  {
    id: 'p3',
    name: 'Pedro',
    needsHelp: false,
    medical: ['Hipertensión controlada'],
    notes: [],
    publicNotes: ['Primera semana en el gimnasio.'],
  },
];

// GET /history/trainer-assistance — who this trainer helped.
export const ASSISTANCE_HISTORY = [
  { id: 'h1', name: 'Juanita Pirula', date: '06/11/2026 · 17:40', machine: 'Prensa de piernas', minutes: 12, rating: 5 },
  { id: 'h2', name: 'Pedro', date: '06/11/2026 · 16:05', machine: 'Remo sentado', minutes: 8, rating: 4 },
  { id: 'h3', name: 'Juan Pirulo', date: '05/11/2026 · 19:20', machine: 'Press de banca', minutes: 15, rating: null },
  { id: 'h4', name: 'Juanita Pirula', date: '03/11/2026 · 18:10', machine: 'Cinta de correr', minutes: 6, rating: 5 },
];

// GET /routines/requests/all — members asking for a routine.
export const ROUTINE_REQUESTS = [
  { id: 'r1', name: 'Pedro', goal: 'Ganar masa muscular', level: 'Principiante', days: 3, date: '06/11/2026' },
  { id: 'r2', name: 'Juanita Pirula', goal: 'Bajar de peso', level: 'Intermedio', days: 4, date: '05/11/2026' },
  { id: 'r3', name: 'Juan Pirulo', goal: 'Mejorar resistencia', level: 'Avanzado', days: 5, date: '04/11/2026' },
];

// GET /qr/machine-conflicts — two people scanned the same machine.
export const MACHINE_CONFLICTS = [
  { id: 'c1', machine: 'Prensa de piernas', detectedAt: '06/11/2026 · 18:12', first: 'Juan Pirulo', second: 'Pedro' },
  { id: 'c2', machine: 'Press de banca', detectedAt: '06/11/2026 · 17:55', first: 'Juanita Pirula', second: 'Juan Pirulo' },
];

// Lists the report screen picks from (trainers, people in the gym, machines).
export const REPORT_TRAINERS = [{ id: 't1', name: 'Marcos Gómez' }, { id: 't2', name: 'Lucía Fernández' }];
export const REPORT_MACHINES = [
  { id: 'm1', name: 'Prensa de piernas' },
  { id: 'm2', name: 'Press de banca' },
  { id: 'm3', name: 'Remo sentado' },
  { id: 'm4', name: 'Cinta de correr 3' },
];

// GET /gym/status-style summary shown on the "Gym" tab.
export const GYM_STATUS = { peopleInGym: 24, machinesInUse: 9, machinesTotal: 32, helpRequests: 1 };
