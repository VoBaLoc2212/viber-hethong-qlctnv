export type CurrencyCode = "VND" | "USD";

export type FxRate = {
  id: string;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate: string;
  rateDate: string;
  source: string;
  fetchedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ConvertedAmount = {
  originalAmount: string;
  originalCurrency: CurrencyCode;
  convertedAmount: string;
  convertedCurrency: "VND";
  rate: string;
  rateDate: string;
  source: string;
  fetchedAt: string;
};
