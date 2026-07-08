-- AlterTable: User gets a timestamp to throttle the once-a-year birthday
-- congratulation email/notification (see src/jobs/birthday.job.js). Note
-- there is no "age" column here on purpose — age is always computed on the
-- fly from `birthday` (see src/utils/age.js) so it can never go stale.
ALTER TABLE "User" ADD COLUMN "lastBirthdayEmailAt" TIMESTAMP(3);
