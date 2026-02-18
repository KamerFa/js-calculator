-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN "confirmationPrefix" TEXT NOT NULL DEFAULT 'RN';
ALTER TABLE "AppSettings" ADD COLUMN "onboardingComplete" BOOLEAN NOT NULL DEFAULT false;
