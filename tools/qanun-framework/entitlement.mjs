import crypto from 'node:crypto';
export const tokenHash = token=>crypto.createHash('sha256').update(token).digest('hex');
// Local operator-owned registry only. Production needs an identity provider and durable quotas.
export function authorise(registry,token,tool,now=Date.now()) {
  if(typeof token!=='string'||token.length<32)throw Error('Access denied');
  const hash=tokenHash(token);
  const grant=registry?.grants?.find(g=>typeof g.token_sha256==='string'&&/^[a-f0-9]{64}$/.test(g.token_sha256)&&crypto.timingSafeEqual(Buffer.from(g.token_sha256,'hex'),Buffer.from(hash,'hex')));
  if(!grant||grant.status!=='active'||grant.revoked_at||!Number.isFinite(Date.parse(grant.expires_at))||Date.parse(grant.expires_at)<=now)throw Error('Access denied');
  if(!['individual_monthly','individual_annual','institutional'].includes(grant.plan)||!grant.subject||!Array.isArray(grant.tools)||!grant.tools.includes(tool))throw Error('Access denied');
  if(grant.plan==='institutional') {
    const account=registry.institutions?.find(a=>a.id===grant.institution_id);
    if(!account||account.status!=='active'||!Number.isSafeInteger(account.seat_limit)||account.seat_limit<1||!Array.isArray(account.active_subjects)||new Set(account.active_subjects).size!==account.active_subjects.length||account.active_subjects.length>account.seat_limit||!account.active_subjects.includes(grant.subject)||!account.permitted_tools?.includes(tool)||!(Date.parse(account.expires_at)>now))throw Error('Access denied');
  }
  if(!Number.isSafeInteger(grant.session_call_limit)||grant.session_call_limit<1)throw Error('Access denied');
  return {subject:grant.subject,plan:grant.plan,session_call_limit:grant.session_call_limit};
}
