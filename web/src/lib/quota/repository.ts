import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccountSummary, CueReservation } from '../account/types';

export class QuotaExhaustedError extends Error {
  code = 'quota_exhausted';
  status = 429;
  constructor(message = 'Daily cue quota exhausted') {
    super(message);
    this.name = 'QuotaExhaustedError';
  }
}

export async function getAccountSummary(
  supabase: SupabaseClient
): Promise<AccountSummary> {
  const { data, error } = await supabase.rpc('get_account_summary');

  if (error || !data || data.length === 0) {
    throw new Error(error?.message ?? 'Failed to retrieve account summary');
  }

  const row = data[0];

  return {
    email: row.email,
    plan: row.plan,
    allowance: row.allowance,
    consumed: row.consumed,
    reserved: row.reserved,
    remaining: row.remaining,
    resetsAt: new Date(row.resets_at).toISOString(),
    subscriptionStatus: row.subscription_status ?? null,
  };
}

export async function reserveCue(
  supabase: SupabaseClient,
  requestKey: string
): Promise<CueReservation> {
  const { data, error } = await supabase.rpc('reserve_cue', {
    p_request_key: requestKey,
  });

  if (error) {
    if (error.message?.includes('quota_exhausted') || error.code === 'P0001') {
      throw new QuotaExhaustedError();
    }
    throw new Error(error.message);
  }

  const row = data[0];
  if (!row) {
    throw new Error('Failed to reserve cue');
  }

  return {
    reservationId: row.reservation_id,
    allowance: row.allowance,
    consumed: row.consumed,
    reserved: row.reserved,
    remaining: row.remaining,
    resetsAt: new Date(row.resets_at).toISOString(),
  };
}

export async function commitCue(
  supabase: SupabaseClient,
  reservationId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('commit_cue', {
    p_reservation_id: reservationId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function releaseCue(
  supabase: SupabaseClient,
  reservationId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('release_cue', {
    p_reservation_id: reservationId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}
