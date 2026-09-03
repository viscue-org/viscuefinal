import 'server-only';
import DodoPayments from 'dodopayments';

let dodoClientInstance: DodoPayments | null = null;

export function createDodoClient(): DodoPayments {
  if (dodoClientInstance) return dodoClientInstance;

  const apiKey = process.env.DODO_PAYMENTS_API_KEY;
  if (!apiKey) {
    throw new Error('DODO_PAYMENTS_API_KEY is not configured');
  }

  const environment =
    process.env.DODO_PAYMENTS_MODE === 'test' ? 'test_mode' : 'live_mode';

  dodoClientInstance = new DodoPayments({
    bearerToken: apiKey,
    environment,
  });

  return dodoClientInstance;
}
