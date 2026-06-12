export const cardioMachine = {
  id: 'machine-cardio-001',
  name: 'Treadmill Pro X',
  category: 'cardio',
  description: 'High-speed treadmill with incline',
  muscleGroups: ['legs', 'glutes', 'calves'],
  status: 'available',
  alternativeExercises: ['stationary_bike', 'elliptical'],
};

export const strengthMachine = {
  id: 'machine-strength-001',
  name: 'Leg Press 3000',
  category: 'strength',
  description: 'Heavy-duty leg press machine',
  muscleGroups: ['quadriceps', 'glutes', 'hamstrings'],
  status: 'available',
  alternativeExercises: ['barbell_squat'],
};

export const flexibilityMachine = {
  id: 'machine-flex-001',
  name: 'Stretching Station',
  category: 'flexibility',
  description: 'Full-body stretching equipment',
  muscleGroups: ['all'],
  status: 'available',
};

export const createMachinePayload = {
  name: 'New Machine',
  category: 'strength',
  description: 'Test machine',
  muscleGroups: ['chest', 'triceps'],
  alternativeExercises: ['barbell_press'],
};

export const updateMachinePayload = {
  name: 'Updated Machine Name',
  description: 'Updated description',
  status: 'maintenance',
};

export const qrCodePayload = {
  code: 'qr-test-001',
  type: 'machine',
  machineId: 'machine-cardio-001',
  qrImageBase64: 'data:image/png;base64,mockdata',
};

export const machineReviewPayload = {
  rating: 5,
  comment: 'Great equipment!',
};