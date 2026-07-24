(() => {
  'use strict';

  const EXPECTED_ROSTER_COUNT = 840;
  let installed = false;

  function rowToLegacyPlayer(row) {
    const raw = row.raw_record && typeof row.raw_record === 'object' ? row.raw_record : {};
    return {
      ...raw,
      name: row.display_name,
      pos: row.position,
      height: row.height || raw.height || '',
      weight: row.weight || raw.weight || '',
      college: row.college_entry || raw.college || '',
      entry: row.acquisition_entry || raw.entry || '',
      terms: row.contract_terms || raw.terms || '',
      bonus: row.signing_bonus || raw.bonus || '',
      cap: row.cap_hit || raw.cap || '',
      years: row.years_remaining ?? raw.years ?? 1,
      stats: row.player_stats || raw.stats || {},
      status: row.roster_status || raw.status || 'Active',
      photo: row.photo_url || raw.photo || '',
      age: row.age_text || raw.age || 'Pending'
    };
  }

  function setRosterStatus(state, detail) {
    const status = document.getElementById('sflDbStatus');
    const info = document.getElementById('sflDbDetail');
    const dot = document.getElementById('sflDbDot');
    if (!status || !info || !dot) return;
    const colors = { loading:'#60a5fa', success:'#22c55e', error:'#ef4444' };
    dot.style.background = colors[state] || '#f59e0b';
    if (state === 'success') status.textContent = 'Prospects + Rosters: Supabase connected';
    if (state === 'loading') status.textContent = 'Loading Supabase rosters…';
    if (state === 'error') status.textContent = 'Roster database unavailable';
    info.textContent = detail;
  }

  function installRosterRows(rows) {
    const grouped = {};
    for (const row of rows) {
      const slug = row.teams?.slug;
      if (!slug) continue;
      (grouped[slug] ||= []).push(row);
    }

    for (const slug of Object.keys(grouped)) {
      grouped[slug].sort((a, b) => (a.roster_order || 0) - (b.roster_order || 0));
      const legacy = grouped[slug].map(rowToLegacyPlayer);

      if (slug === 'los-angeles-avengers') {
        v20OriginalAvengersRoster.splice(0, v20OriginalAvengersRoster.length, ...legacy);
      } else if (V20_IMPORTED_TEAMS[slug]) {
        V20_IMPORTED_TEAMS[slug].players = legacy;
      }

      const state = typeof v20State === 'function' ? v20State(slug) : null;
      if (state) state.roster = legacy.map(player => ({ ...player }));
    }

    if (typeof v20ApplyTeam === 'function' && typeof v20SelectedTeam !== 'undefined') {
      v20ApplyTeam(v20SelectedTeam);
    }
    installed = true;
  }

  async function loadRosters() {
    if (!window.sflSupabase) return false;
    setRosterStatus('loading', 'Loading all 20 active team rosters.');
    try {
      const { data, error } = await window.sflSupabase
        .from('roster_players')
        .select(`
          source_key, roster_order, display_name, position, height, weight,
          college_entry, acquisition_entry, contract_terms, signing_bonus,
          cap_hit, years_remaining, player_stats, roster_status, photo_url,
          age_text, raw_record,
          teams!inner ( slug )
        `)
        .order('roster_order', { ascending: true });

      if (error) throw error;
      if ((data || []).length !== EXPECTED_ROSTER_COUNT) {
        throw new Error(`Expected ${EXPECTED_ROSTER_COUNT} roster players but received ${(data || []).length}.`);
      }

      installRosterRows(data);
      setRosterStatus('success', `348 prospects and ${data.length} roster players loaded from Supabase.`);
      console.info('[SFL] Supabase roster import complete:', data.length);
      return true;
    } catch (error) {
      console.error('[SFL] Supabase roster import failed:', error);
      setRosterStatus('error', `${error.message || error}. Embedded rosters remain available.`);
      return false;
    }
  }

  async function waitForClient() {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (window.sflSupabase) {
        await loadRosters();
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  window.SFL_SUPABASE_PHASE_3 = {
    expectedRosterCount: EXPECTED_ROSTER_COUNT,
    reload: loadRosters,
    get installed() { return installed; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForClient, { once:true });
  } else {
    waitForClient();
  }
})();
