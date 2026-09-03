export type AccountPlan = 'free' | 'plus' | 'pro';

export type AccountSummary = {
  email: string;
  plan: AccountPlan;
  allowance: 9 | 28 | 99;
  consumed: number;
  reserved: number;
  remaining: number;
  resetsAt: string;
  subscriptionStatus: string | null;
};

export type CueReservation = {
  reservationId: string;
  allowance: number;
  consumed: number;
  reserved: number;
  remaining: number;
  resetsAt: string;
};
