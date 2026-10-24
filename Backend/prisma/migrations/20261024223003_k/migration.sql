-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "slug" TEXT,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "descriptionEn" TEXT,
    "muscles" TEXT[],
    "machineKeywords" TEXT[],
    "level" "ExperienceLevel" NOT NULL DEFAULT 'BEGINNER',
    "category" "TrainingType" NOT NULL DEFAULT 'STRENGTH',
    "defaultSets" INTEGER NOT NULL DEFAULT 3,
    "defaultReps" TEXT NOT NULL DEFAULT '10-12',
    "imageUrl" TEXT,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneralRoutine" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "description" TEXT,
    "level" "ExperienceLevel",
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneralRoutine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneralRoutineExercise" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" TEXT NOT NULL,

    CONSTRAINT "GeneralRoutineExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "exercises" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "generalRoutineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_slug_key" ON "Exercise"("slug");

-- CreateIndex
CREATE INDEX "Exercise_createdById_idx" ON "Exercise"("createdById");

-- CreateIndex
CREATE INDEX "Exercise_isCustom_idx" ON "Exercise"("isCustom");

-- CreateIndex
CREATE INDEX "Exercise_active_idx" ON "Exercise"("active");

-- CreateIndex
CREATE UNIQUE INDEX "GeneralRoutine_slug_key" ON "GeneralRoutine"("slug");

-- CreateIndex
CREATE INDEX "GeneralRoutine_active_idx" ON "GeneralRoutine"("active");

-- CreateIndex
CREATE INDEX "GeneralRoutineExercise_exerciseId_idx" ON "GeneralRoutineExercise"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneralRoutineExercise_routineId_position_key" ON "GeneralRoutineExercise"("routineId", "position");

-- CreateIndex
CREATE INDEX "ScheduleDay_userId_idx" ON "ScheduleDay"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleDay_userId_date_key" ON "ScheduleDay"("userId", "date");

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneralRoutineExercise" ADD CONSTRAINT "GeneralRoutineExercise_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "GeneralRoutine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneralRoutineExercise" ADD CONSTRAINT "GeneralRoutineExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleDay" ADD CONSTRAINT "ScheduleDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
