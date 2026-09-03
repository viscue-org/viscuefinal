// Pure account view model for extension popup and workspace

export function accountView(summary) {
  if (!summary) {
    return {
      state: 'signed-out',
      plan: 'free',
      count: '9/9',
      email: null,
      resetsAt: null,
    };
  }

  const remaining = typeof summary.remaining === 'number' ? summary.remaining : 0;
  const allowance = typeof summary.allowance === 'number' ? summary.allowance : 9;

  return {
    state: remaining === 0 ? 'exhausted' : 'ready',
    email: summary.email || 'Authenticated user',
    plan: summary.plan || 'free',
    count: `${remaining}/${allowance}`,
    resetsAt: summary.resetsAt ? new Date(summary.resetsAt).toISOString() : null,
    subscriptionStatus: summary.subscriptionStatus || null,
  };
}
