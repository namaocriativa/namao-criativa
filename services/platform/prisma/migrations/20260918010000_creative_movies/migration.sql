-- CreateTable
CREATE TABLE "CreativeMovie" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "aspectRatio" TEXT NOT NULL DEFAULT '16:9',
    "duration" TEXT NOT NULL DEFAULT '8s',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeMovie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeMovieShot" (
    "id" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "scene" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "dialogue" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "error" TEXT NOT NULL DEFAULT '',
    "localPath" TEXT NOT NULL DEFAULT '',
    "filename" TEXT NOT NULL DEFAULT '',
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeMovieShot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CreativeMovie_createdByUserId_idx" ON "CreativeMovie"("createdByUserId");
CREATE INDEX "CreativeMovie_updatedAt_idx" ON "CreativeMovie"("updatedAt");
CREATE INDEX "CreativeMovieShot_movieId_sortOrder_idx" ON "CreativeMovieShot"("movieId", "sortOrder");
CREATE INDEX "CreativeMovieShot_characterId_idx" ON "CreativeMovieShot"("characterId");

ALTER TABLE "CreativeMovie" ADD CONSTRAINT "CreativeMovie_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreativeMovieShot" ADD CONSTRAINT "CreativeMovieShot_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "CreativeMovie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeMovieShot" ADD CONSTRAINT "CreativeMovieShot_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "CreativeCharacter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
