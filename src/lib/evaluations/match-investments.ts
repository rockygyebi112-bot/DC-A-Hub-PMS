import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

export type MatchResult = {
  investment_id: string | null;
  match_status: 'auto' | 'manual' | 'unmatched';
  raw_investment_name: string;
};

const TRIGRAM_THRESHOLD = 0.85;

export async function matchInvestment(args: {
  evaluationId: string;
  community: string;
  rawName: string;
}): Promise<MatchResult> {
  const sb = createServiceClient();

  // Exact case-insensitive in-community.
  const exact = await sb
    .from('mis_investments')
    .select('id, investment_name')
    .eq('evaluation_id', args.evaluationId)
    .ilike('community', args.community)
    .ilike('investment_name', args.rawName.trim())
    .limit(1);
  if (exact.data && exact.data.length > 0) {
    return {
      investment_id: exact.data[0].id,
      match_status: 'auto',
      raw_investment_name: args.rawName,
    };
  }

  // Trigram fuzzy via RPC.
  const fuzzy = await sb.rpc('match_mis_investment_fuzzy', {
    p_evaluation_id: args.evaluationId,
    p_community: args.community,
    p_raw_name: args.rawName,
    p_threshold: TRIGRAM_THRESHOLD,
  });
  if (!fuzzy.error && fuzzy.data && Array.isArray(fuzzy.data) && fuzzy.data.length > 0) {
    return {
      investment_id: (fuzzy.data[0] as { id: string }).id,
      match_status: 'auto',
      raw_investment_name: args.rawName,
    };
  }

  return {
    investment_id: null,
    match_status: 'unmatched',
    raw_investment_name: args.rawName,
  };
}
