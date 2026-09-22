CREATE TABLE "CreativeMovieShotCast" (
    "shotId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CreativeMovieShotCast_pkey" PRIMARY KEY ("shotId","characterId")
);

CREATE INDEX "CreativeMovieShotCast_characterId_idx" ON "CreativeMovieShotCast"("characterId");
CREATE INDEX "CreativeMovieShotCast_shotId_sortOrder_idx" ON "CreativeMovieShotCast"("shotId", "sortOrder");

ALTER TABLE "CreativeMovieShotCast" ADD CONSTRAINT "CreativeMovieShotCast_shotId_fkey" FOREIGN KEY ("shotId") REFERENCES "CreativeMovieShot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeMovieShotCast" ADD CONSTRAINT "CreativeMovieShotCast_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "CreativeCharacter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "CreativeMovieShotCast" ("shotId", "characterId", "sortOrder")
SELECT "id", "characterId", 0
FROM "CreativeMovieShot"
ON CONFLICT ("shotId", "characterId") DO NOTHING;
