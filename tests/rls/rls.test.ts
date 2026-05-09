import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminClient, cleanupTestData, createTestUser, clientAs } from './setup';

const STAFF_A = 'rlstest-staff-a@example.com';
const CLIENT_A = 'rlstest-client-a@example.com';
const CLIENT_B = 'rlstest-client-b@example.com';

let projectA: string;
let projectB: string;

beforeAll(async () => {
  const admin = adminClient();

  const staffA  = await createTestUser('staff',  STAFF_A);
  const clientA = await createTestUser('client', CLIENT_A);
  const clientB = await createTestUser('client', CLIENT_B);

  // upsert clients (orgs) by name (which isn't unique by default — use insert+select-by-name semantics).
  // Easiest: select by name first, insert if missing.
  async function ensureOrg(name: string): Promise<string> {
    const { data: existing } = await admin.from('clients').select('id').eq('name', name).maybeSingle();
    if (existing?.id) return existing.id;
    const { data: created, error } = await admin.from('clients').insert({ name }).select('id').single();
    if (error) throw error;
    return created.id;
  }

  const orgA = await ensureOrg('Org A (rlstest)');
  const orgB = await ensureOrg('Org B (rlstest)');

  // upsert projects by code
  async function ensureProject(code: string, name: string, clientId: string): Promise<string> {
    const { data: existing } = await admin.from('projects').select('id').eq('code', code).maybeSingle();
    if (existing?.id) return existing.id;
    const { data: created, error } = await admin
      .from('projects')
      .insert({ code, name, client_id: clientId })
      .select('id')
      .single();
    if (error) throw error;
    return created.id;
  }

  projectA = await ensureProject('RLSA', 'Project A (rlstest)', orgA);
  projectB = await ensureProject('RLSB', 'Project B (rlstest)', orgB);

  await admin.from('project_members').upsert([
    { project_id: projectA, user_id: staffA,   project_role: 'member' },
    { project_id: projectA, user_id: clientA,  project_role: 'viewer' },
    { project_id: projectB, user_id: clientB,  project_role: 'viewer' },
  ], { onConflict: 'project_id,user_id' });
}, 60_000);

afterAll(async () => {
  await cleanupTestData();
}, 60_000);

describe('RLS — projects', () => {
  it('client A sees project A but not project B', async () => {
    const sb = await clientAs(CLIENT_A);
    const { data } = await sb.from('projects').select('id, code');
    const codes = (data ?? []).map((p) => p.code);
    expect(codes).toContain('RLSA');
    expect(codes).not.toContain('RLSB');
  });

  it('client B sees project B but not project A', async () => {
    const sb = await clientAs(CLIENT_B);
    const { data } = await sb.from('projects').select('id, code');
    const codes = (data ?? []).map((p) => p.code);
    expect(codes).toContain('RLSB');
    expect(codes).not.toContain('RLSA');
  });

  it('client cannot insert a project', async () => {
    const sb = await clientAs(CLIENT_A);
    const { error } = await sb.from('projects').insert({
      name: 'evil', code: 'EVIL', client_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(error).not.toBeNull();
  });

  it('staff member of project A can update its description', async () => {
    const sb = await clientAs(STAFF_A);
    const { error } = await sb.from('projects').update({ description: 'updated by staff' }).eq('id', projectA);
    expect(error).toBeNull();
  });
});
