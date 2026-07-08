-- Pantalla U: perfil mínimo (4 campos de opciones fijas)
-- 1) objetivo principal      -> MainGoal[]           (ya existía como Json libre)
-- 2) nivel actual            -> ExperienceLevel       (ya existía como String libre)
-- 3) días que entrena/semana -> TrainingFrequency     (campo nuevo)
-- 4) tipo de entrenamiento   -> TrainingType           (campo nuevo)

-- CreateEnum
CREATE TYPE "MainGoal" AS ENUM ('LOSE_WEIGHT', 'GAIN_MUSCLE', 'IMPROVE_HEALTH', 'INCREASE_ENDURANCE');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "TrainingFrequency" AS ENUM ('ONE_TO_TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN');

-- CreateEnum
CREATE TYPE "TrainingType" AS ENUM ('STRENGTH', 'CARDIO', 'FUNCTIONAL', 'MIXED');

-- AlterTable: trainingLevel (String? free text -> ExperienceLevel? fixed enum)
-- Existing free-text values that don't match one of the 3 fixed options are
-- reset to NULL (the user will be prompted to re-select from the fixed list
-- next time they open pantalla U) rather than aborting the migration.
ALTER TABLE "User" ADD COLUMN "trainingLevel_new" "ExperienceLevel";

UPDATE "User"
SET "trainingLevel_new" = CASE upper("trainingLevel")
  WHEN 'BEGINNER' THEN 'BEGINNER'::"ExperienceLevel"
  WHEN 'INTERMEDIATE' THEN 'INTERMEDIATE'::"ExperienceLevel"
  WHEN 'ADVANCED' THEN 'ADVANCED'::"ExperienceLevel"
  ELSE NULL
END
WHERE "trainingLevel" IS NOT NULL;

ALTER TABLE "User" DROP COLUMN "trainingLevel";
ALTER TABLE "User" RENAME COLUMN "trainingLevel_new" TO "trainingLevel";

-- AlterTable: objectives (Json? free array -> MainGoal[] fixed enum array)
-- Same idea: any element that isn't one of the 4 fixed options is dropped
-- (not the whole row) so a user who had 2 valid + 1 legacy free-text goal
-- keeps their 2 valid ones instead of losing everything.
ALTER TABLE "User" ADD COLUMN "objectives_new" "MainGoal"[] NOT NULL DEFAULT ARRAY[]::"MainGoal"[];

UPDATE "User"
SET "objectives_new" = COALESCE((
  SELECT array_agg(mapped)
  FROM (
    SELECT CASE upper(elem #>> '{}')
      WHEN 'LOSE_WEIGHT' THEN 'LOSE_WEIGHT'::"MainGoal"
      WHEN 'GAIN_MUSCLE' THEN 'GAIN_MUSCLE'::"MainGoal"
      WHEN 'IMPROVE_HEALTH' THEN 'IMPROVE_HEALTH'::"MainGoal"
      WHEN 'INCREASE_ENDURANCE' THEN 'INCREASE_ENDURANCE'::"MainGoal"
      ELSE NULL
    END AS mapped
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof("objectives") = 'array' THEN "objectives" ELSE '[]'::jsonb END
    ) AS elem
  ) AS mapped_elems
  WHERE mapped IS NOT NULL
), ARRAY[]::"MainGoal"[])
WHERE "objectives" IS NOT NULL;

ALTER TABLE "User" DROP COLUMN "objectives";
ALTER TABLE "User" RENAME COLUMN "objectives_new" TO "objectives";

-- AlterTable: new fields
ALTER TABLE "User" ADD COLUMN "weeklyTrainingDays" "TrainingFrequency";
ALTER TABLE "User" ADD COLUMN "trainingType" "TrainingType";
