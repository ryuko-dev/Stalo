/**
 * Exchange Rate Service
 * Fetches currency exchange rates from exchangerate-api.com (free tier)
 */

interface ExchangeRates {
  [currency: string]: number;
}

let cachedRates: ExchangeRates | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Fetch exchange rates with USD as base currency
 * Uses free tier of exchangerate-api.com (1500 requests/month)
 */
export async function getExchangeRates(): Promise<ExchangeRates> {
  // Return cached rates if still valid
  if (cachedRates && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedRates;
  }

  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Store rates with USD as base (1 USD = X currency)
    cachedRates = data.rates;
    cacheTimestamp = Date.now();
    
    return data.rates;
  } catch (error) {
    console.error('Failed to fetch exchange rates:', error);
    
    // Return fallback rates if API fails
    return getFallbackRates();
  }
}

/**
 * Convert amount from source currency to USD
 */
export async function convertToUSD(amount: number, fromCurrency: string): Promise<number> {
  if (fromCurrency === 'USD' || fromCurrency === 'N/A') {
    return amount;
  }

  try {
    const rates = await getExchangeRates();
    
    // rates[currency] gives us: 1 USD = X currency
    // To convert from currency to USD: amount / rates[currency]
    const rate = rates[fromCurrency];
    if (!rate) {
      console.warn(`No exchange rate found for ${fromCurrency}, using fallback`);
      return amount; // Return original if no rate found
    }
    
    return amount / rate;
  } catch (error) {
    console.error(`Failed to convert ${fromCurrency} to USD:`, error);
    return amount; // Return original on error
  }
}

/**
 * Fallback exchange rates in case API is unavailable
 */
function getFallbackRates(): ExchangeRates {
  return {
    AED: 3.67,
    EUR: 0.92,
    GBP: 0.79,
    USD: 1,
    INR: 83.12,
    SAR: 3.75,
    QAR: 3.64,
    OMR: 0.38,
    KWD: 0.31,
    BHD: 0.38,
  };
}
