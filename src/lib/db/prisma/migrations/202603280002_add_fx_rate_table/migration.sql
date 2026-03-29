CREATE TABLE IF NOT EXISTS "FxRate" (
  "id" TEXT NOT NULL,
  "fromCurrency" TEXT NOT NULL,
  "toCurrency" TEXT NOT NULL,
  "rateDate" TIMESTAMP(3) NOT NULL,
  "rate" DECIMAL(18,6) NOT NULL,
  "source" TEXT NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FxRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FxRate_fromCurrency_toCurrency_rateDate_source_key"
  ON "FxRate"("fromCurrency", "toCurrency", "rateDate", "source");

CREATE INDEX IF NOT EXISTS "FxRate_fromCurrency_toCurrency_rateDate_idx"
  ON "FxRate"("fromCurrency", "toCurrency", "rateDate");
