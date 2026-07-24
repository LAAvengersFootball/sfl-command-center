(() => {
  'use strict';

  const PROJECT_URL = 'https://iuggxkpdwxdrbgknldqq.supabase.co';
  const KEY_STORAGE = 'sfl_supabase_publishable_key';
  const SOURCE_STORAGE = 'sfl_prospect_data_source';
  const positionBuckets = {
    QB: qbPlayers,
    RB: rbPlayers,
    FB: fbPlayers,
    TE: tePlayers,
    WR: wrPlayers,
    DE: dePlayers,
    DT: dtPlayers,
    LB: lbPlayers,
    CB: cbPlayers,
    S: sPlayers,
    K: kPlayers,
    P: pPlayers,
    OL: olPlayers
  };

  function relationOne(value) {
    return Array.isArray(value) ? (value[0] || {}) : (value || {});
  }

  function relationMany(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  function mapProspect(row) {
    const profile = relationOne(row.prospect_profiles);
    const college = relationOne(row.colleges);
    const seasons = relationMany(row.prospect_seasons)
      .slice()
      .sort((a, b) => Number(a.season_order || 0) - Number(b.season_order || 0))
      .map(item => ({
        season: item.season_label || '',
        school: item.school_name || college.school_name || '',
        games: item.games ?? '—',
        starts: item.starts ?? '—',
        ...(item.stats || {}),
        note: item.note || ''
      }));
    const links = relationMany(row.prospect_sources).map(item => [item.label, item.url]);

    return {
      id: Number(row.id),
      name: row.display_name || [row.first_name, row.last_name].filter(Boolean).join(' '),
      pos: row.primary_position,
      position_group: row.position_group,
      school: college.school_name || '',
      college_id: college.slug || '',
      tier: profile.tier || '',
      guideRank: profile.guide_rank,
      logo: row.college_logo_url || college.logo_url || '',
      verified: Boolean(profile.is_verified),
      researchStatus: profile.research_status || '',
      level: college.level || '',
      conference: college.conference || '',
      division: college.division || '',
      age: row.age_text || '',
      height: row.height || '',
      weight: row.weight || '',
      nfl: row.nfl_summary || '',
      nflRound: row.nfl_round,
      nflRoster: row.nfl_roster,
      nflDrafted: Number(row.nfl_round) > 0,
      production: profile.production_notes || [],
      productionGrade: profile.production_grade || '',
      athleticGrade: profile.athletic_grade || '',
      valueGrade: profile.value_grade || '',
      fitGrade: profile.fit_grade || '',
      score: profile.command_center_score == null ? null : Number(profile.command_center_score),
      cap: profile.projected_cap || '',
      links,
      seasonHistory: seasons,
      photo: row.photo_url || '',
      canonicalBoard: profile.canonical_board !== false,
      boardSource: profile.board_source || '',
      boardGroup: profile.board_group || '',
      boardRank: profile.board_rank,
      boardSponsor: profile.board_sponsor || '',
      statsCoverage: profile.stats_coverage || '',
      statsVerifiedRows: profile.stats_verified_rows,
      statsTotalRows: profile.stats_total_rows,
      lastAudited: profile.last_audited || '',
      source_group: profile.source_group || ''
    };
  }

  function installProspects(prospects) {
    Object.values(positionBuckets).forEach(bucket => bucket.splice(0, bucket.length));

    for (const player of prospects) {
      const group = player.position_group || (['OT', 'OG', 'C'].includes(player.pos) ? 'OL' : player.pos);
      if (positionBuckets[group]) positionBuckets[group].push(player);
    }

    scoutingPlayers.splice(
      0,
      scoutingPlayers.length,
      ...prospects.filter(player =>
        !(Number(player.nflRound) >= 1 && Number(player.nflRound) <= 3) &&
        !territorialExcluded.has(prospectNameKey(player.name))
      )
    );

    DATA.prospects = prospects;
    DATA.qbPlayers = qbPlayers;
    DATA.rbPlayers = rbPlayers;
    DATA.fbPlayers = fbPlayers;
    DATA.tePlayers = tePlayers;
    DATA.wrPlayers = wrPlayers;
    DATA.dePlayers = dePlayers;
    DATA.dtPlayers = dtPlayers;
    DATA.lbPlayers = lbPlayers;
    DATA.cbPlayers = cbPlayers;
    DATA.sPlayers = sPlayers;
    DATA.kPlayers = kPlayers;
    DATA.pPlayers = pPlayers;
    DATA.olPlayers = olPlayers;

    if (typeof drawScouting === 'function' && document.getElementById('scoutingCards')) drawScouting();
    if (typeof renderProspectSearch === 'function' && document.getElementById('v21ProspectList')) renderProspectSearch();
    if (typeof replaceDashboard === 'function') replaceDashboard();
  }

  function addConnectionPanel() {
    let panel = document.getElementById('sflSupabasePanel');
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'sflSupabasePanel';
    panel.style.cssText = [
      'position:fixed', 'right:12px', 'bottom:12px', 'z-index:100000',
      'max-width:310px', 'padding:10px 12px', 'border-radius:10px',
      'background:#111827', 'color:#fff', 'border:1px solid rgba(255,255,255,.18)',
      'box-shadow:0 8px 28px rgba(0,0,0,.35)', 'font:12px/1.35 Arial,sans-serif'
    ].join(';');
    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px">
        <span id="sflDbDot" style="width:9px;height:9px;border-radius:50%;background:#f59e0b;display:inline-block"></span>
        <strong id="sflDbStatus">Prospect Lab: embedded fallback</strong>
      </div>
      <div id="sflDbDetail" style="opacity:.75;margin-top:4px">Supabase has not been connected in this browser.</div>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button id="sflDbConnect" style="flex:1;padding:7px;border:0;border-radius:7px;cursor:pointer">Connect Supabase</button>
        <button id="sflDbRetry" style="padding:7px;border:0;border-radius:7px;cursor:pointer">Retry</button>
      </div>`;
    document.body.appendChild(panel);
    document.getElementById('sflDbConnect').onclick = configureKey;
    document.getElementById('sflDbRetry').onclick = loadFromSupabase;
    return panel;
  }

  function setStatus(state, title, detail) {
    addConnectionPanel();
    const colors = { loading: '#60a5fa', success: '#22c55e', error: '#ef4444', fallback: '#f59e0b' };
    document.getElementById('sflDbDot').style.background = colors[state] || colors.fallback;
    document.getElementById('sflDbStatus').textContent = title;
    document.getElementById('sflDbDetail').textContent = detail;
  }

  function configureKey() {
    const current = localStorage.getItem(KEY_STORAGE) || '';
    const key = prompt(
      'Paste the Supabase publishable key (or legacy anon key). Do not paste a service_role or secret key.',
      current
    );
    if (key === null) return;
    const clean = key.trim();
    if (!clean) {
      localStorage.removeItem(KEY_STORAGE);
      localStorage.setItem(SOURCE_STORAGE, 'embedded');
      setStatus('fallback', 'Prospect Lab: embedded fallback', 'Saved Supabase key was removed.');
      return;
    }
    if (/service[_-]?role|secret/i.test(clean)) {
      alert('That appears to be a secret or service-role key. Do not place it in a website. Use the publishable or anon key.');
      return;
    }
    localStorage.setItem(KEY_STORAGE, clean);
    loadFromSupabase();
  }

  async function loadFromSupabase() {
    addConnectionPanel();
    const key = localStorage.getItem(KEY_STORAGE);
    if (!key) {
      setStatus('fallback', 'Prospect Lab: embedded fallback', 'Tap Connect Supabase and paste the publishable key.');
      return;
    }
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      setStatus('error', 'Supabase library unavailable', 'Check the internet connection and reload the page.');
      return;
    }

    setStatus('loading', 'Connecting to Supabase…', 'Loading league prospect records.');
    try {
      const client = window.supabase.createClient(PROJECT_URL, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      window.sflSupabase = client;

      const { data, error } = await client
        .from('players')
        .select(`
          id, display_name, first_name, last_name, primary_position, position_group,
          draft_class, height, weight, age_text, photo_url, college_logo_url,
          nfl_summary, nfl_round, nfl_roster,
          colleges ( slug, school_name, level, conference, division, logo_url ),
          prospect_profiles (*),
          prospect_seasons (*),
          prospect_sources (*)
        `)
        .in('player_status', ['prospect', 'draft_eligible', 'excluded'])
        .order('id', { ascending: true });

      if (error) throw error;
      const prospects = (data || []).map(mapProspect);
      if (prospects.length !== 348) {
        throw new Error(`Expected 348 prospects but Supabase returned ${prospects.length}.`);
      }

      installProspects(prospects);
      localStorage.setItem(SOURCE_STORAGE, 'supabase');
      setStatus('success', 'Prospect Lab: Supabase connected', `${prospects.length} prospects loaded from the live database.`);
      console.info('[SFL] Supabase prospect import complete:', prospects.length);
    } catch (error) {
      console.error('[SFL] Supabase prospect import failed:', error);
      localStorage.setItem(SOURCE_STORAGE, 'embedded');
      setStatus('error', 'Supabase connection failed', `${error.message || error}. Embedded data remains active.`);
    }
  }

  window.SFL_SUPABASE_PHASE_2 = {
    projectUrl: PROJECT_URL,
    connect: configureKey,
    reload: loadFromSupabase,
    clearKey() {
      localStorage.removeItem(KEY_STORAGE);
      localStorage.setItem(SOURCE_STORAGE, 'embedded');
      location.reload();
    }
  };

  function boot() {
    addConnectionPanel();
    loadFromSupabase();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
