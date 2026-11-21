-- CreateTable
CREATE TABLE "AnalysisCache" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "textHash" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL,
    "topics" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "needsReply" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Review" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reviewId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "rating" INTEGER,
    "date" TEXT,
    "originalText" TEXT NOT NULL,
    "cleanText" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "duplicateOf" TEXT,
    "sentiment" TEXT,
    "topics" TEXT,
    "summary" TEXT,
    "needsReply" BOOLEAN,
    "suggestedReply" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UploadRun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fileName" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "analysedCount" INTEGER NOT NULL,
    "duplicateCount" INTEGER NOT NULL,
    "skippedCount" INTEGER NOT NULL,
    "failedCount" INTEGER NOT NULL,
    "aiCalls" INTEGER NOT NULL,
    "cacheHits" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisCache_textHash_key" ON "AnalysisCache"("textHash");
