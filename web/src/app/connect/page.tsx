import { redirect } from 'next/navigation';
import { createServerClient } from '../../lib/supabase/server';
import { requireUser } from '../../lib/auth/require-user';
import { validateAuthorizationRequest } from '../../features/connect/authorize';
import { ConsentCard } from '../../features/connect/consent-card';
import { publicEnv } from '../../lib/env';

export default async function ConnectPage(props: {
  searchParams: Promise<{
    client_id?: string;
    redirect_uri?: string;
    response_type?: string;
    code_challenge?: string;
    code_challenge_method?: string;
    state?: string;
    scope?: string;
  }>;
}) {
  const searchParams = await props.searchParams;

  // Validate the OAuth 2.1 request parameters
  const validation = validateAuthorizationRequest(searchParams);

  if (!validation.ok) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: '420px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 90, 54, 0.4)', borderRadius: '16px', padding: '32px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#FF7D60', marginBottom: '12px' }}>
            Invalid Authorization Request
          </h1>
          <p style={{ color: '#8E9BAE', fontSize: '14px', lineHeight: 1.5 }}>
            The authorization request could not be verified ({validation.error}). Please trigger connection directly from the Viscue extension.
          </p>
        </div>
      </main>
    );
  }

  // Check user authentication
  const supabase = await createServerClient();
  let user;

  try {
    user = await requireUser(supabase);
  } catch {
    const connectPath = `/connect?${new URLSearchParams(
      searchParams as Record<string, string>
    ).toString()}`;
    redirect(`/login?next=${encodeURIComponent(connectPath)}`);
  }

  const { redirect_uri, state, scope, code_challenge, code_challenge_method } = validation.params;
  const scopesList = scope.split(' ').filter(Boolean);

  const supabaseUrl = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const approveAction = `${supabaseUrl}/auth/v1/oauth/authorize?client_id=${encodeURIComponent(
    validation.params.client_id
  )}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&code_challenge=${encodeURIComponent(
    code_challenge
  )}&code_challenge_method=${encodeURIComponent(
    code_challenge_method
  )}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(scope)}`;

  const denyUrl = `${redirect_uri}?error=access_denied&state=${encodeURIComponent(state)}`;

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <ConsentCard
        userEmail={user.email ?? 'Authenticated user'}
        clientName="Viscue Chrome Extension"
        scopes={scopesList}
        approveAction={approveAction}
        denyUrl={denyUrl}
      />
    </main>
  );
}
