import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Clean existing data
  await prisma.userNotification.deleteMany();
  await prisma.interactionLog.deleteMany();
  await prisma.adminReport.deleteMany();
  await prisma.rewardClaim.deleteMany();
  await prisma.reward.deleteMany();
  await prisma.checkIn.deleteMany();
  await prisma.qrScanLog.deleteMany();
  await prisma.qrCode.deleteMany();
  await prisma.machineReview.deleteMany();
  await prisma.machineUsage.deleteMany();
  await prisma.challenge.deleteMany();
  await prisma.trainerAnnotation.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.socialInteraction.deleteMany();
  await prisma.blocked.deleteMany();
  await prisma.routineAnnotation.deleteMany();
  await prisma.routine.deleteMany();
  await prisma.progressUpdate.deleteMany();
  await prisma.helpRequest.deleteMany();
  await prisma.personalBest.deleteMany();
  await prisma.weightLog.deleteMany();
  await prisma.userPersonalization.deleteMany();
  await prisma.userPoints.deleteMany();
  await prisma.userSettings.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.machine.deleteMany();
  await prisma.gymSettings.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Cleaned existing data');

  // Create GymSettings
  const gymSettings = await prisma.gymSettings.create({
    data: {
      gymName: 'FitZone Gym',
      gymDescription: 'Premium fitness center with state-of-the-art equipment',
      gymAddress: '123 Fitness Ave, Sport City',
      openTime: '06:00',
      closeTime: '23:00',
      maxCapacity: 200,
      pointsPerCheckIn: 10,
      pointsPerHelpReceived: 50,
      pointsPerProgressVerified: 100,
      pointsPerSocialConnection: 25,
      pointsPerChallengeCompleted: 75,
      pointsPerQRScan: 5,
      mainPhoneNumber: '+1-555-0100',
      mainEmail: 'contact@fitzone.local',
    },
  });

  console.log('✅ Created GymSettings');

  // Hash password
  const hashedPassword = await bcrypt.hash('TestPassword123!', 12);

  // Create Admin User
  const admin = await prisma.user.create({
    data: {
      email: 'admin@fitzone.local',
      username: 'admin_user',
      password: hashedPassword,
      fullName: 'Admin User',
      role: 'ADMIN',
      emailVerified: true,
      profileComplete: true,
      settings: {
        create: {},
      },
      points: {
        create: { totalPoints: 1000, currentPoints: 1000 },
      },
      profile: {
        create: {
          age: 35,
          weight: 75,
          height: 180,
          fitnessLevel: 'advanced',
          goals: ['strength', 'muscle_gain'],
        },
      },
    },
  });

  console.log('✅ Created Admin User:', admin.email);

  // Create Trainer Users
  const trainer1 = await prisma.user.create({
    data: {
      email: 'trainer1@fitzone.local',
      username: 'trainer_carlos',
      password: hashedPassword,
      fullName: 'Carlos Rodríguez',
      role: 'TRAINER',
      emailVerified: true,
      profileComplete: true,
      specialties: ['strength', 'muscle_gain', 'weight_loss'],
      settings: {
        create: {},
      },
      points: {
        create: { totalPoints: 500, currentPoints: 500 },
      },
      profile: {
        create: {
          age: 28,
          weight: 82,
          height: 185,
          fitnessLevel: 'advanced',
          goals: ['strength'],
        },
      },
    },
  });

  const trainer2 = await prisma.user.create({
    data: {
      email: 'trainer2@fitzone.local',
      username: 'trainer_maria',
      password: hashedPassword,
      fullName: 'María González',
      role: 'TRAINER',
      emailVerified: true,
      profileComplete: true,
      specialties: ['cardio', 'flexibility', 'rehabilitation'],
      settings: {
        create: {},
      },
      points: {
        create: { totalPoints: 450, currentPoints: 450 },
      },
      profile: {
        create: {
          age: 26,
          weight: 65,
          height: 168,
          fitnessLevel: 'advanced',
          goals: ['flexibility'],
        },
      },
    },
  });

  console.log('✅ Created Trainer Users');

  // Create Regular Users
  const user1 = await prisma.user.create({
    data: {
      email: 'juan@example.com',
      username: 'juan_fit',
      password: hashedPassword,
      fullName: 'Juan Pérez',
      role: 'USER',
      emailVerified: true,
      profileComplete: true,
      settings: {
        create: {},
      },
      points: {
        create: { totalPoints: 250, currentPoints: 200 },
      },
      profile: {
        create: {
          age: 32,
          weight: 88,
          height: 178,
          fitnessLevel: 'beginner',
          goals: ['lose_weight', 'strength'],
          injuries: ['lower_back_strain'],
        },
      },
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: 'sofia@example.com',
      username: 'sofia_gym',
      password: hashedPassword,
      fullName: 'Sofía Martinez',
      role: 'USER',
      emailVerified: true,
      profileComplete: true,
      settings: {
        create: {},
      },
      points: {
        create: { totalPoints: 350, currentPoints: 300 },
      },
      profile: {
        create: {
          age: 27,
          weight: 62,
          height: 165,
          fitnessLevel: 'intermediate',
          goals: ['gain_muscle', 'strength'],
        },
      },
    },
  });

  const user3 = await prisma.user.create({
    data: {
      email: 'diego@example.com',
      username: 'diego_trainer',
      password: hashedPassword,
      fullName: 'Diego López',
      role: 'USER',
      emailVerified: true,
      profileComplete: true,
      settings: {
        create: {},
      },
      points: {
        create: { totalPoints: 180, currentPoints: 150 },
      },
      profile: {
        create: {
          age: 29,
          weight: 90,
          height: 182,
          fitnessLevel: 'intermediate',
          goals: ['endurance', 'sport_training'],
        },
      },
    },
  });

  console.log('✅ Created Regular Users');

  // Create Machines
  const cardioMachine = await prisma.machine.create({
    data: {
      name: 'Treadmill Pro X',
      category: 'cardio',
      description: 'High-speed treadmill with incline control',
      muscleGroups: ['legs', 'glutes', 'calves'],
      status: 'available',
      alternativeExercises: ['stationary_bike', 'elliptical'],
    },
  });

  const strengthMachine = await prisma.machine.create({
    data: {
      name: 'Leg Press 3000',
      category: 'strength',
      description: 'Heavy-duty leg press machine',
      muscleGroups: ['quadriceps', 'glutes', 'hamstrings'],
      status: 'available',
      alternativeExercises: ['barbell_squat', 'hack_squat'],
    },
  });

  const flexibilityMachine = await prisma.machine.create({
    data: {
      name: 'Stretching Station',
      category: 'flexibility',
      description: 'Full-body stretching and mobility equipment',
      muscleGroups: ['all'],
      status: 'available',
    },
  });

  const chestMachine = await prisma.machine.create({
    data: {
      name: 'Chest Press Pro',
      category: 'strength',
      description: 'Advanced chest press machine',
      muscleGroups: ['chest', 'triceps', 'shoulders'],
      status: 'available',
    },
  });

  console.log('✅ Created Machines');

  // Create QR Codes
  const qr1 = await prisma.qrCode.create({
    data: {
      code: uuidv4(),
      type: 'machine',
      machineId: cardioMachine.id,
      qrImageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    },
  });

  const qr2 = await prisma.qrCode.create({
    data: {
      code: uuidv4(),
      type: 'machine',
      machineId: strengthMachine.id,
      qrImageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    },
  });

  const qr3 = await prisma.qrCode.create({
    data: {
      code: uuidv4(),
      type: 'personal',
      userId: user1.id,
      qrImageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    },
  });

  console.log('✅ Created QR Codes');

  // Create Routines (Default)
  const routineDefault = await prisma.routine.create({
    data: {
      createdBy: trainer1.id,
      name: 'Beginner Full Body',
      description: 'Perfect routine for beginners starting their fitness journey',
      isDefault: true,
      isActive: true,
      exercises: [
        { name: 'Treadmill', sets: 3, reps: 10, weight: 0 },
        { name: 'Leg Press', sets: 3, reps: 10, weight: 100 },
        { name: 'Chest Press', sets: 3, reps: 8, weight: 50 },
      ],
      targetGoals: ['lose_weight', 'strength'],
      fitnessLevel: 'beginner',
    },
  });

  const routineUser = await prisma.routine.create({
    data: {
      userId: user1.id,
      createdBy: trainer1.id,
      name: 'Juan\'s Custom Routine',
      description: 'Personalized routine for weight loss and strength building',
      isActive: true,
      exercises: [
        { name: 'Treadmill', sets: 4, reps: 20, weight: 0, notes: '30 minutes cardio' },
        { name: 'Leg Press', sets: 4, reps: 12, weight: 120 },
        { name: 'Chest Press', sets: 3, reps: 10, weight: 60 },
      ],
      targetGoals: ['lose_weight', 'strength'],
      fitnessLevel: 'beginner',
    },
  });

  console.log('✅ Created Routines');

  // Create Progress Updates
  const progressUpdate = await prisma.progressUpdate.create({
    data: {
      userId: user1.id,
      trainerId: trainer1.id,
      exerciseName: 'Leg Press',
      weight: 120,
      reps: 12,
      notes: 'Good form, felt strong',
      status: 'approved',
      verifiedAt: new Date(),
    },
  });

  console.log('✅ Created Progress Updates');

  // Create Help Requests
  const helpRequest = await prisma.helpRequest.create({
    data: {
      userId: user2.id,
      trainerId: trainer2.id,
      description: 'Need help with proper chest press form',
      category: 'POSTURE',
      status: 'completed',
      rating: 5,
      ratingComment: 'Very helpful, learned a lot!',
      completedAt: new Date(),
    },
  });

  console.log('✅ Created Help Requests');

  // Create Check-ins
  await prisma.checkIn.create({
    data: {
      userId: user1.id,
      entryTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
      exitTime: new Date(),
      durationMinutes: 120,
    },
  });

  console.log('✅ Created Check-ins');

  // Create Social Interactions
  await prisma.socialInteraction.create({
    data: {
      initiatorId: user1.id,
      receiverId: user2.id,
      type: 'follow',
      status: 'accepted',
      confirmedAt: new Date(),
    },
  });

  console.log('✅ Created Social Interactions');

  // Create Rewards
  const reward = await prisma.reward.create({
    data: {
      name: 'Free Personal Training Session',
      description: '1-on-1 personalized training session with a certified trainer',
      pointsCost: 500,
      quantity: 5,
      available: true,
      createdBy: admin.id,
    },
  });

  const reward2 = await prisma.reward.create({
    data: {
      name: 'Protein Shake Pack',
      description: '6-pack of premium protein shakes',
      pointsCost: 200,
      quantity: 20,
      available: true,
      createdBy: admin.id,
    },
  });

  console.log('✅ Created Rewards');

  // Create Challenge
  const challenge = await prisma.challenge.create({
    data: {
      initiatorId: user1.id,
      receiverId: user2.id,
      machineId: strengthMachine.id,
      status: 'pending',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('✅ Created Challenge');

  // Create Notifications
  await prisma.userNotification.create({
    data: {
      userId: user1.id,
      type: 'help_request_received',
      title: 'Trainer Response',
      message: 'Carlos has responded to your help request',
      data: { helpRequestId: helpRequest.id },
    },
  });

  console.log('✅ Created Notifications');

  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });