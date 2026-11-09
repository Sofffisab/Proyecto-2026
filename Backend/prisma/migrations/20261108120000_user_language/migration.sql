-- App language chosen in Settings (es | en), used for texts the Backend writes.
ALTER TABLE "User" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'es';
