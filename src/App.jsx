import { useState, useEffect, useCallback } from 'react';
import { save, load } from './storage.js';
import { calcPoints } from './scoring.js';
import { fetchMatches } from './openfootball.js';
import { DEFAULT_USERS } from './users.js';

// ─── Time helpers ─────────────────────────────────────────────────────────────
function canBet(matchDate) {
  return Date.now() < new Date(matchDate).getTime() - 30 * 60 * 1000;
}
function timeLeft(matchDate) {
  const diff = new Date(matchDate).getTime() - 30 * 60 * 1000 - Date.now();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000);
  if (h > 48) { const d = Math.floor(h / 24); return `${d}z ${h % 24}h`; }
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
function fmtDate(ds) {
  const d = new Date(ds);
  return d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', weekday: 'short' })
    + ' ' + d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  bg: '#080d18', surface: '#0f1923', card: '#162032', border: '#1c3354',
  accent: '#00d4ff', accent2: '#00ff88', text: '#ddeeff', muted: '#5a7a9a',
  danger: '#ff4444', warn: '#ffc832', gold: '#ffd700',
};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  // Users — stored in localStorage so admin can change them
  const [users, setUsers] = useState(() => load('wc_users', DEFAULT_USERS));

  // Session
  const [currentUserId, setCurrentUserId] = useState(() => load('wc_session', null));

  // Game data
  const [predictions,   setPredictions]   = useState(() => load('wc_preds', {}));
  const [finalists,     setFinalists]      = useState(() => load('wc_finals', {}));
  const [manualResults, setManualResults]  = useState(() => load('wc_results', {}));
  const [actualFinals,  setActualFinals]   = useState(() => load('wc_actualfinals', []));

  // Openfootball
  const [matches,   setMatches]   = useState(() => load('wc_matches', []));
  const [lastSync,  setLastSync]  = useState(() => load('wc_last_sync', null));
  const [syncing,   setSyncing]   = useState(false);
  const [syncMsg,   setSyncMsg]   = useState('');

  const [tab, setTab] = useState('matches');
  const [now, setNow] = useState(Date.now());

  // Persist everything
  useEffect(() => save('wc_users', users),            [users]);
  useEffect(() => save('wc_session', currentUserId),  [currentUserId]);
  useEffect(() => save('wc_preds', predictions),      [predictions]);
  useEffect(() => save('wc_finals', finalists),       [finalists]);
  useEffect(() => save('wc_results', manualResults),  [manualResults]);
  useEffect(() => save('wc_actualfinals', actualFinals), [actualFinals]);
  useEffect(() => save('wc_matches', matches),        [matches]);
  useEffect(() => save('wc_last_sync', lastSync),     [lastSync]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  // Auto-sync on load if stale (> 30 min)
  useEffect(() => {
    if (!lastSync || Date.now() - lastSync > 30 * 60 * 1000) sync();
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true); setSyncMsg('');
    try {
      const fetched = await fetchMatches();
      if (!fetched.length) throw new Error('Nicio dată primită');
      setMatches(fetched);

      // Auto-apply scores from openfootball (don't overwrite manual entries)
      setManualResults(prev => {
        const next = { ...prev };
        fetched.forEach(m => {
          if (m.score && !next[m.id]) next[m.id] = m.score;
        });
        return next;
      });

      setLastSync(Date.now());
      setSyncMsg(`✅ ${fetched.length} meciuri actualizate`);
    } catch (e) {
      setSyncMsg(`⚠️ Eroare: ${e.message}`);
    }
    setSyncing(false);
  }, []);

  // Merged results: openfootball scores + manual overrides
  const results = { ...manualResults };
  matches.forEach(m => {
    if (m.score && !results[m.id]) results[m.id] = m.score;
  });

  const currentUser = users.find(u => u.id === currentUserId) || null;
  const isAdmin = currentUser?.isAdmin === true;

  // Login
  const login = (username, password) => {
    const u = users.find(u => u.id.toLowerCase() === username.toLowerCase() && u.password === password);
    if (u) { setCurrentUserId(u.id); return true; }
    return false;
  };

  // Predictions
  const setPred = (matchId, side, val) => {
    setPredictions(prev => ({
      ...prev,
      [currentUserId]: {
        ...(prev[currentUserId] || {}),
        [matchId]: { ...(prev[currentUserId]?.[matchId] || {}), [side]: val },
      },
    }));
  };

  const setFinalistPred = (idx, team) => {
    setFinalists(prev => {
      const cur = [...(prev[currentUserId] || [null, null])];
      cur[idx] = team;
      return { ...prev, [currentUserId]: cur };
    });
  };

  const setManualResult = (matchId, side, val) => {
    setManualResults(prev => ({
      ...prev,
      [matchId]: { ...(prev[matchId] || {}), [side]: val },
    }));
  };

  // Leaderboard
  const players = users.filter(u => !u.isAdmin);
  const leaderboard = players
    .map(u => {
      const { pts, exact, penalties } = calcPoints(
        predictions[u.id] || {}, results, finalists[u.id] || [], actualFinals, matches
      );
      return { ...u, pts, exact, penalties };
    })
    .sort((a, b) => b.pts - a.pts || b.exact - a.exact);

  const allTeams = [...new Set(matches.flatMap(m => [m.home, m.away]))].sort();

  const campStarted = now > new Date('2026-06-11T19:00:00Z').getTime();

  if (!currentUser) {
    return <LoginScreen users={users} onLogin={login} />;
  }

  return (
    <div style={s.root}>
      <Header
        user={currentUser} isAdmin={isAdmin}
        onLogout={() => setCurrentUserId(null)}
        tab={tab} setTab={setTab}
      />
      <main style={s.main}>
        {tab === 'matches' && (
          <MatchesTab
            matches={matches} predictions={predictions[currentUserId] || {}}
            results={results} setPred={setPred}
            syncing={syncing} syncMsg={syncMsg} lastSync={lastSync} onSync={sync}
          />
        )}
        {tab === 'finalists' && (
          <FinalistsTab
            userPred={finalists[currentUserId] || [null, null]}
            actualFinals={actualFinals} isAdmin={isAdmin}
            onSetPred={setFinalistPred} onSetActual={setActualFinals}
            allTeams={allTeams} campStarted={campStarted}
            allPlayers={players} allFinalists={finalists}
          />
        )}
        {tab === 'standings' && (
          <StandingsTab leaderboard={leaderboard} />
        )}
        {tab === 'profile' && (
          <ProfileTab
            currentUser={currentUser}
            onChangePassword={(oldPwd, newPwd) => {
              if (currentUser.password !== oldPwd) return 'Parola curentă este greșită.';
              setUsers(prev => prev.map(u => u.id === currentUser.id ? { ...u, password: newPwd } : u));
              return null;
            }}
            onChangeName={(name) => {
              if (!name.trim()) return 'Numele nu poate fi gol.';
              setUsers(prev => prev.map(u => u.id === currentUser.id ? { ...u, name: name.trim() } : u));
              return null;
            }}
          />
        )}
        {tab === 'admin' && isAdmin && (
          <AdminTab
            matches={matches} results={results} setResult={setManualResult}
            actualFinals={actualFinals} setActualFinals={setActualFinals}
            syncing={syncing} syncMsg={syncMsg} lastSync={lastSync} onSync={sync}
            users={users} setUsers={setUsers}
            predictions={predictions} finalists={finalists}
          />
        )}
      </main>
    </div>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginScreen({ users, onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const handleLogin = () => {
    if (!username || !password) { setErr('Completează username și parolă.'); return; }
    const ok = onLogin(username, password);
    if (!ok) setErr('Username sau parolă incorectă.');
  };

  return (
    <div style={s.loginBg}>
      <div style={s.loginCard}>
        <div style={{ fontSize: 52, textAlign: 'center' }}>⚽</div>
        <h1 style={s.loginTitle}>CM 2026</h1>
        <p style={{ color: C.muted, textAlign: 'center', margin: 0, fontSize: 14 }}>
          Campionat Amical de Pariuri
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={s.label}>Username</label>
          <input style={s.input} autoCapitalize="none" autoCorrect="off"
            placeholder="ex: alex" value={username}
            onChange={e => { setUsername(e.target.value); setErr(''); }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()} />

          <label style={s.label}>Parolă</label>
          <div style={{ position: 'relative' }}>
            <input style={{ ...s.input, paddingRight: 40 }} type={showPwd ? 'text' : 'password'}
              placeholder="••••••••" value={password}
              onChange={e => { setPassword(e.target.value); setErr(''); }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            <button onClick={() => setShowPwd(p => !p)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 16 }}>
              {showPwd ? '🙈' : '👁️'}
            </button>
          </div>

          {err && <p style={{ color: C.danger, fontSize: 13, margin: 0 }}>{err}</p>}
          <button style={{ ...s.btnPrimary, marginTop: 4 }} onClick={handleLogin}>
            Intră în joc →
          </button>
        </div>

        <details style={{ marginTop: 8 }}>
          <summary style={{ color: C.muted, fontSize: 12, cursor: 'pointer' }}>
            Vezi userii disponibili
          </summary>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {users.map(u => (
              <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between',
                fontSize: 12, color: C.muted, padding: '3px 0', borderBottom: `1px solid ${C.border}` }}>
                <span>{u.name} {u.isAdmin ? '(admin)' : ''}</span>
                <span style={{ fontFamily: 'monospace' }}>{u.id}</span>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
function Header({ user, isAdmin, onLogout, tab, setTab }) {
  const tabs = [
    { id: 'matches',   label: '⚽ Meciuri' },
    { id: 'finalists', label: '🏆 Finaliste' },
    { id: 'standings', label: '📊 Clasament' },
    { id: 'profile',   label: '👤 Profil' },
    ...(isAdmin ? [{ id: 'admin', label: '⚙️ Admin' }] : []),
  ];
  return (
    <header style={s.header}>
      <div style={s.headerInner}>
        <span style={s.logo}>CM 2026 🌍</span>
        <nav style={s.nav}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ ...s.navBtn, ...(tab === t.id ? s.navActive : {}) }}>
              {t.label}
            </button>
          ))}
        </nav>
        <button style={s.btnLogout} onClick={onLogout}>Ieși</button>
      </div>
    </header>
  );
}

// ─── Matches Tab ──────────────────────────────────────────────────────────────
function MatchesTab({ matches, predictions, results, setPred, syncing, syncMsg, lastSync, onSync }) {
  const [filter, setFilter] = useState('Toate');

  const roundOrder = ['Toate','Grupe','16-imi','Optimi','Sferturi','Semifinale','Finala Mică','FINALA'];
  const availableRounds = roundOrder.filter(r =>
    r === 'Toate' || r === 'Grupe'
      ? matches.some(m => r === 'Grupe' ? !!m.group : true)
      : matches.some(m => m.round === r)
  );

  const filtered = matches.filter(m => {
    if (filter === 'Toate') return true;
    if (filter === 'Grupe') return !!m.group;
    return m.round === filter;
  });

  return (
    <div style={s.section}>
      <SyncBar syncing={syncing} syncMsg={syncMsg} lastSync={lastSync} onSync={onSync} />

      {matches.length === 0 && !syncing && (
        <div style={s.emptyBox}>
          📡 Apasă <strong>Actualizează</strong> pentru a încărca meciurile de la openfootball.
        </div>
      )}

      <FilterRow rounds={availableRounds} filter={filter} setFilter={setFilter} />

      <div style={s.matchList}>
        {filtered.map(m => (
          <MatchCard key={m.id} match={m} pred={predictions[m.id]}
            result={results[m.id]} setPred={setPred} />
        ))}
        {filtered.length === 0 && matches.length > 0 && (
          <p style={{ color: C.muted, textAlign: 'center' }}>Niciun meci în această etapă momentan.</p>
        )}
      </div>
    </div>
  );
}

function MatchCard({ match, pred, result, setPred }) {
  const open = canBet(match.date);
  const tl = timeLeft(match.date);
  const played = result && result.home !== '' && result.away !== '' && result.home != null;
  const ph = pred?.home ?? '';
  const pa = pred?.away ?? '';

  let status = null;
  if (played) {
    if (ph !== '' && pa !== '' && ph != null && pa != null) {
      const rh = parseInt(result.home), ra = parseInt(result.away);
      const iph = parseInt(ph), ipa = parseInt(pa);
      if (iph === rh && ipa === ra) status = 'exact';
      else if ((iph > ipa) === (rh > ra) && (iph === ipa) === (rh === ra)) status = 'result';
      else status = 'wrong';
    } else {
      status = 'nopred';
    }
  }

  const SC = { exact: '#00ff88', result: '#ffc832', wrong: '#ff6666', nopred: '#ff4444' };
  const SL = { exact: '⚡ +3 Scor exact!', result: '✓ +1 Rezultat corect', wrong: '✗ 0 pts', nopred: '✗ −1 Nepariat!' };

  return (
    <div style={{ ...s.matchCard, ...(status ? { borderColor: SC[status] + '66' } : {}) }}>
      <div style={s.matchMeta}>
        <span style={s.roundBadge}>{match.round}</span>
        <span style={{ color: C.muted, fontSize: 12 }}>{fmtDate(match.date)}</span>
        {open && tl && <span style={{ color: C.warn, fontSize: 11, fontWeight: 700 }}>⏱ {tl}</span>}
        {!open && !played && <span style={{ color: C.muted, fontSize: 11 }}>🔒 Blocat</span>}
        {played && <span style={{ color: '#888', fontSize: 11 }}>✅ Jucat</span>}
      </div>

      <div style={s.matchRow}>
        <span style={s.team}>{match.home}</span>
        <div style={s.scoreBox}>
          {open ? (
            <>
              <input style={s.scoreIn} type="number" min="0" max="20"
                value={ph} placeholder="—"
                onChange={e => setPred(match.id, 'home', e.target.value)} />
              <span style={s.colon}>:</span>
              <input style={s.scoreIn} type="number" min="0" max="20"
                value={pa} placeholder="—"
                onChange={e => setPred(match.id, 'away', e.target.value)} />
            </>
          ) : (
            <>
              <span style={s.scoreStatic}>{ph !== '' ? ph : '—'}</span>
              <span style={s.colon}>:</span>
              <span style={s.scoreStatic}>{pa !== '' ? pa : '—'}</span>
            </>
          )}
        </div>
        <span style={{ ...s.team, textAlign: 'right' }}>{match.away}</span>
      </div>

      {played && (
        <div style={s.resultRow}>
          <span style={{ color: C.muted, fontSize: 13 }}>
            Scor real: <strong style={{ color: C.text }}>{result.home} – {result.away}</strong>
          </span>
          {status && (
            <span style={{ ...s.badge, background: SC[status] + '22', color: SC[status] }}>
              {SL[status]}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Finalists Tab ────────────────────────────────────────────────────────────
function FinalistsTab({ userPred, actualFinals, isAdmin, onSetPred, onSetActual, allTeams, campStarted, allPlayers, allFinalists }) {
  const [q, setQ] = useState('');
  const teams = allTeams.length > 0 ? allTeams :
    ['Brazilia','Argentina','Franta','Anglia','Spania','Germania','Portugalia','Olanda'];
  const filtered = teams.filter(t => t.toLowerCase().includes(q.toLowerCase()));
  const locked = campStarted && !isAdmin;

  return (
    <div style={s.section}>
      <div style={s.card}>
        <h2 style={s.sectionTitle}>🏆 Pariază Finalistele</h2>
        <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
          Ghicește ambele echipe care ajung în finală. <strong style={{ color: C.accent }}>+1 pt</strong> per
          echipă ghicită corect, <strong style={{ color: C.accent }}>+3 pts</strong> dacă le ghicești pe amândouă.
          Trebuie alese înainte de startul campionatului.
        </p>

        {locked && (
          <div style={s.alertBox}>⚠️ Campionatul a început — predicțiile pentru finaliste sunt blocate.</div>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[0, 1].map(i => (
            <div key={i} style={s.finSlot}>
              <span style={{ color: C.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                Finalista {i + 1}
              </span>
              <span style={{ fontSize: 16, fontWeight: 800, color: userPred[i] ? C.accent : C.muted }}>
                {userPred[i] || '—'}
              </span>
              {userPred[i] && !locked && (
                <button style={s.clearBtn} onClick={() => onSetPred(i, null)}>✕</button>
              )}
            </div>
          ))}
        </div>

        {!locked && (
          <>
            <input style={s.input} placeholder="Caută echipă..." value={q}
              onChange={e => setQ(e.target.value)} />
            <div style={s.teamGrid}>
              {filtered.map(t => (
                <button key={t}
                  style={{ ...s.teamBtn, ...(userPred.includes(t) ? s.teamBtnOn : {}) }}
                  onClick={() => {
                    if (userPred.includes(t)) return;
                    if (!userPred[0]) onSetPred(0, t);
                    else if (!userPred[1]) onSetPred(1, t);
                  }}>{t}</button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Show all players' finalists picks */}
      <div style={s.card}>
        <h3 style={{ color: C.text, fontSize: 15, fontWeight: 700, margin: 0 }}>
          🎯 Pariurile tuturor jucătorilor
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {allPlayers.map(u => {
            const fp = allFinalists[u.id] || [];
            return (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', background: C.surface, borderRadius: 10 }}>
                <span style={{ flex: 1, fontWeight: 600 }}>{u.name}</span>
                <span style={{ color: fp[0] ? C.accent : C.muted, fontSize: 13 }}>{fp[0] || '—'}</span>
                <span style={{ color: C.muted }}>vs</span>
                <span style={{ color: fp[1] ? C.accent : C.muted, fontSize: 13 }}>{fp[1] || '—'}</span>
              </div>
            );
          })}
        </div>
      </div>

      {isAdmin && (
        <div style={s.card}>
          <h3 style={{ color: C.text, fontSize: 15, fontWeight: 700, margin: 0 }}>⚙️ Finaliste reale (admin)</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[0, 1].map(i => (
              <div key={i} style={{ flex: 1, minWidth: 160 }}>
                <p style={{ color: C.muted, fontSize: 12, margin: '0 0 6px' }}>Finalista reală {i + 1}</p>
                <select style={s.select} value={actualFinals[i] || ''}
                  onChange={e => { const nf = [...actualFinals]; nf[i] = e.target.value; onSetActual(nf); }}>
                  <option value="">—</option>
                  {teams.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            ))}
          </div>
          {actualFinals[0] && actualFinals[1] && (
            <p style={{ color: C.accent2, fontWeight: 600, fontSize: 14, margin: 0 }}>
              ✅ {actualFinals[0]} vs {actualFinals[1]}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Standings Tab ────────────────────────────────────────────────────────────
function StandingsTab({ leaderboard }) {
  return (
    <div style={s.section}>
      <h2 style={s.sectionTitle}>📊 Clasament</h2>
      <div style={s.table}>
        <div style={s.tableHead}>
          <span style={{ width: 36 }}>#</span>
          <span style={{ flex: 1 }}>Jucător</span>
          <span style={{ width: 60, textAlign: 'center' }}>Pts</span>
          <span style={{ width: 80, textAlign: 'center' }}>Exacte</span>
          <span style={{ width: 76, textAlign: 'center' }}>Penaliz.</span>
        </div>
        {leaderboard.map((p, i) => (
          <div key={p.id} style={{ ...s.tableRow, ...(i === 0 ? { background: C.gold + '12' } : {}) }}>
            <span style={{ width: 36, fontWeight: 700,
              color: i === 0 ? C.gold : i === 1 ? '#b0b8c8' : i === 2 ? '#c87533' : C.muted }}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
            </span>
            <span style={{ flex: 1, fontWeight: i === 0 ? 700 : 400 }}>{p.name}</span>
            <span style={{ width: 60, textAlign: 'center', fontWeight: 800, fontSize: '1.1em', color: C.accent2 }}>
              {p.pts}
            </span>
            <span style={{ width: 80, textAlign: 'center', color: '#64b5f6' }}>{p.exact}</span>
            <span style={{ width: 76, textAlign: 'center', color: '#ff8a80' }}>
              {p.penalties > 0 ? `−${p.penalties}` : '0'}
            </span>
          </div>
        ))}
      </div>
      <p style={{ color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
        Departajare: mai multe scoruri exacte. Egalitate perfectă → se împart banii.
      </p>
      <div style={{ ...s.card, marginTop: 4 }}>
        <h3 style={{ color: C.text, fontSize: 14, fontWeight: 700, margin: 0 }}>📖 Sistem de punctaj</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: C.muted }}>
          <div style={s.ruleRow}><span style={{ color: C.accent2, fontWeight: 700 }}>+3 pts</span> Scor exact (ex: 2-1 ghicit 2-1)</div>
          <div style={s.ruleRow}><span style={{ color: C.warn, fontWeight: 700 }}>+1 pt</span> Rezultat corect (câștigătorul/egalul ghicit, scor diferit)</div>
          <div style={s.ruleRow}><span style={{ color: C.accent, fontWeight: 700 }}>+1 pt</span> Per finalista ghicită corect · <span style={{ color: C.accent, fontWeight: 700 }}>+3 pts</span> dacă ghicești ambele</div>
          <div style={s.ruleRow}><span style={{ color: C.danger, fontWeight: 700 }}>−1 pt</span> Meci nepariat (scorul trebuie pus cu 30 min înainte)</div>
        </div>
      </div>
    </div>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────
function ProfileTab({ currentUser, onChangePassword, onChangeName }) {
  const [newName, setNewName] = useState(currentUser.name);
  const [oldPwd, setOldPwd]   = useState('');
  const [newPwd, setNewPwd]   = useState('');
  const [confPwd, setConfPwd] = useState('');
  const [msg, setMsg]         = useState(null); // { type: 'ok'|'err', text }

  const handleName = () => {
    const err = onChangeName(newName);
    setMsg(err ? { type: 'err', text: err } : { type: 'ok', text: 'Nume actualizat!' });
  };

  const handlePwd = () => {
    if (!oldPwd || !newPwd || !confPwd) return setMsg({ type: 'err', text: 'Completează toate câmpurile.' });
    if (newPwd !== confPwd) return setMsg({ type: 'err', text: 'Parolele noi nu coincid.' });
    if (newPwd.length < 4) return setMsg({ type: 'err', text: 'Parola trebuie să aibă minim 4 caractere.' });
    const err = onChangePassword(oldPwd, newPwd);
    if (err) setMsg({ type: 'err', text: err });
    else { setMsg({ type: 'ok', text: 'Parolă schimbată cu succes!' }); setOldPwd(''); setNewPwd(''); setConfPwd(''); }
  };

  return (
    <div style={s.section}>
      <h2 style={s.sectionTitle}>👤 Profilul meu</h2>

      {msg && (
        <div style={{ ...s.alertBox, background: msg.type === 'ok' ? C.accent2 + '22' : C.danger + '22',
          borderColor: msg.type === 'ok' ? C.accent2 + '66' : C.danger + '66',
          color: msg.type === 'ok' ? C.accent2 : C.danger }}>
          {msg.text}
        </div>
      )}

      <div style={s.card}>
        <h3 style={{ color: C.text, fontSize: 15, fontWeight: 700, margin: 0 }}>✏️ Schimbă numele afișat</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ ...s.input, flex: 1 }} value={newName}
            onChange={e => { setNewName(e.target.value); setMsg(null); }} />
          <button style={s.btnSm} onClick={handleName}>Salvează</button>
        </div>
        <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>
          Username-ul de login (<code style={{ color: C.accent }}>{currentUser.id}</code>) nu se poate schimba.
        </p>
      </div>

      <div style={s.card}>
        <h3 style={{ color: C.text, fontSize: 15, fontWeight: 700, margin: 0 }}>🔑 Schimbă parola</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={s.label}>Parola curentă</label>
            <input style={s.input} type="password" value={oldPwd}
              onChange={e => { setOldPwd(e.target.value); setMsg(null); }} />
          </div>
          <div>
            <label style={s.label}>Parola nouă (minim 4 caractere)</label>
            <input style={s.input} type="password" value={newPwd}
              onChange={e => { setNewPwd(e.target.value); setMsg(null); }} />
          </div>
          <div>
            <label style={s.label}>Confirmă parola nouă</label>
            <input style={s.input} type="password" value={confPwd}
              onChange={e => { setConfPwd(e.target.value); setMsg(null); }} />
          </div>
          <button style={s.btnPrimary} onClick={handlePwd}>Schimbă parola</button>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Tab ────────────────────────────────────────────────────────────────
function AdminTab({ matches, results, setResult, actualFinals, setActualFinals,
  syncing, syncMsg, lastSync, onSync, users, setUsers, predictions, finalists }) {
  const [subTab, setSubTab] = useState('results');

  const subTabs = [
    { id: 'results', label: '⚽ Rezultate' },
    { id: 'users',   label: '👥 Utilizatori' },
  ];

  return (
    <div style={s.section}>
      <h2 style={s.sectionTitle}>⚙️ Panou Admin</h2>
      <div style={s.filterRow}>
        {subTabs.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            style={{ ...s.filterBtn, ...(subTab === t.id ? s.filterBtnActive : {}) }}>
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'results' && (
        <AdminResults matches={matches} results={results} setResult={setResult}
          actualFinals={actualFinals} setActualFinals={setActualFinals}
          syncing={syncing} syncMsg={syncMsg} lastSync={lastSync} onSync={onSync} />
      )}
      {subTab === 'users' && (
        <AdminUsers users={users} setUsers={setUsers} predictions={predictions} finalists={finalists} />
      )}
    </div>
  );
}

function AdminResults({ matches, results, setResult, actualFinals, setActualFinals,
  syncing, syncMsg, lastSync, onSync }) {
  const [filter, setFilter] = useState('Grupe');

  const roundOrder = ['Grupe','16-imi','Optimi','Sferturi','Semifinale','Finala Mică','FINALA'];
  const availableRounds = roundOrder.filter(r =>
    r === 'Grupe' ? matches.some(m => !!m.group) : matches.some(m => m.round === r)
  );

  const filtered = matches.filter(m =>
    filter === 'Grupe' ? !!m.group : m.round === filter
  );

  const allTeams = [...new Set(matches.flatMap(m => [m.home, m.away]))].sort();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SyncBar syncing={syncing} syncMsg={syncMsg} lastSync={lastSync} onSync={onSync} full />

      <FilterRow rounds={availableRounds} filter={filter} setFilter={setFilter} />

      <div style={s.matchList}>
        {filtered.map(m => (
          <div key={m.id} style={s.adminRow}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 11, color: C.muted }}>{fmtDate(m.date)} · {m.round}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{m.home}</span>
                <input style={s.adminIn} type="number" min="0" max="30" placeholder="0"
                  value={results[m.id]?.home ?? ''}
                  onChange={e => setResult(m.id, 'home', e.target.value)} />
                <span style={{ color: C.muted, fontWeight: 700 }}>–</span>
                <input style={s.adminIn} type="number" min="0" max="30" placeholder="0"
                  value={results[m.id]?.away ?? ''}
                  onChange={e => setResult(m.id, 'away', e.target.value)} />
                <span style={{ fontWeight: 600, fontSize: 14, flex: 1, textAlign: 'right' }}>{m.away}</span>
              </div>
            </div>
            {results[m.id]?.home != null && results[m.id]?.away != null
              && results[m.id]?.home !== '' && results[m.id]?.away !== ''
              && <span style={{ fontSize: 16 }}>✅</span>}
          </div>
        ))}
      </div>

      <div style={s.card}>
        <h3 style={{ color: C.text, fontSize: 15, fontWeight: 700, margin: 0 }}>🏆 Finaliste reale</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[0, 1].map(i => (
            <div key={i} style={{ flex: 1, minWidth: 160 }}>
              <label style={s.label}>Finalista {i + 1}</label>
              <select style={s.select} value={actualFinals[i] || ''}
                onChange={e => { const nf = [...actualFinals]; nf[i] = e.target.value; setActualFinals(nf); }}>
                <option value="">—</option>
                {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          ))}
        </div>
        {actualFinals[0] && actualFinals[1] && (
          <p style={{ color: C.accent2, fontWeight: 600, fontSize: 14, margin: 0 }}>
            ✅ Finala: {actualFinals[0]} vs {actualFinals[1]}
          </p>
        )}
      </div>
    </div>
  );
}

function AdminUsers({ users, setUsers, predictions, finalists }) {
  const [editing, setEditing] = useState(null); // userId being edited
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState(null);
  const [newUser, setNewUser] = useState({ id: '', name: '', password: '', isAdmin: false });
  const [showAddForm, setShowAddForm] = useState(false);

  const startEdit = (u) => {
    setEditing(u.id);
    setForm({ name: u.name, password: u.password, isAdmin: u.isAdmin });
    setMsg(null);
  };

  const saveEdit = () => {
    if (!form.name?.trim()) return setMsg({ type: 'err', text: 'Numele nu poate fi gol.' });
    if (!form.password || form.password.length < 4) return setMsg({ type: 'err', text: 'Parola trebuie să aibă minim 4 caractere.' });
    setUsers(prev => prev.map(u => u.id === editing ? { ...u, name: form.name.trim(), password: form.password, isAdmin: !!form.isAdmin } : u));
    setEditing(null);
    setMsg({ type: 'ok', text: 'Utilizator actualizat.' });
  };

  const deleteUser = (uid) => {
    if (!window.confirm(`Ștergi utilizatorul "${uid}"? Se pierd toate pariurile lui.`)) return;
    setUsers(prev => prev.filter(u => u.id !== uid));
    setMsg({ type: 'ok', text: `Utilizatorul "${uid}" a fost șters.` });
  };

  const addUser = () => {
    if (!newUser.id.trim()) return setMsg({ type: 'err', text: 'ID-ul nu poate fi gol.' });
    if (!/^[a-z0-9_]+$/.test(newUser.id)) return setMsg({ type: 'err', text: 'ID-ul poate conține doar litere mici, cifre, _.' });
    if (users.find(u => u.id === newUser.id)) return setMsg({ type: 'err', text: 'Există deja un user cu acest ID.' });
    if (!newUser.name.trim()) return setMsg({ type: 'err', text: 'Numele nu poate fi gol.' });
    if (!newUser.password || newUser.password.length < 4) return setMsg({ type: 'err', text: 'Parola trebuie să aibă minim 4 caractere.' });
    setUsers(prev => [...prev, { ...newUser, id: newUser.id.trim(), name: newUser.name.trim() }]);
    setNewUser({ id: '', name: '', password: '', isAdmin: false });
    setShowAddForm(false);
    setMsg({ type: 'ok', text: `Utilizatorul "${newUser.id}" adăugat.` });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {msg && (
        <div style={{ ...s.alertBox,
          background: msg.type === 'ok' ? C.accent2 + '22' : C.danger + '22',
          borderColor: msg.type === 'ok' ? C.accent2 + '66' : C.danger + '66',
          color: msg.type === 'ok' ? C.accent2 : C.danger }}>
          {msg.text}
        </div>
      )}

      {users.map(u => (
        <div key={u.id} style={s.card}>
          {editing === u.id ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <code style={{ color: C.accent, fontFamily: 'monospace', fontSize: 13 }}>{u.id}</code>
                {u.isAdmin && <span style={{ ...s.badge, background: C.accent + '22', color: C.accent }}>admin</span>}
              </div>
              <div>
                <label style={s.label}>Nume afișat</label>
                <input style={s.input} value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={s.label}>Parolă nouă</label>
                <input style={s.input} type="text" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              {!u.isAdmin && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.muted, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!form.isAdmin}
                    onChange={e => setForm(f => ({ ...f, isAdmin: e.target.checked }))} />
                  Promovează la Admin
                </label>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={s.btnPrimary} onClick={saveEdit}>💾 Salvează</button>
                <button style={{ ...s.btnSm, background: C.surface }} onClick={() => setEditing(null)}>Anulează</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{u.name}</div>
                <div style={{ color: C.muted, fontSize: 12, fontFamily: 'monospace' }}>
                  {u.id} · {u.isAdmin ? '🔧 admin' : '👤 jucător'}
                </div>
              </div>
              <button style={s.btnSm} onClick={() => startEdit(u)}>✏️ Editează</button>
              {!u.isAdmin && (
                <button style={{ ...s.btnSm, background: C.danger + '22', color: C.danger, borderColor: C.danger + '44' }}
                  onClick={() => deleteUser(u.id)}>🗑️ Șterge</button>
              )}
            </div>
          )}
        </div>
      ))}

      {showAddForm ? (
        <div style={s.card}>
          <h3 style={{ color: C.text, fontSize: 15, fontWeight: 700, margin: 0 }}>➕ Adaugă utilizator</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={s.label}>ID (username de login — doar litere mici/cifre/_)</label>
              <input style={s.input} placeholder="ex: radu" value={newUser.id}
                onChange={e => setNewUser(n => ({ ...n, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,'') }))} />
            </div>
            <div>
              <label style={s.label}>Nume afișat</label>
              <input style={s.input} placeholder="ex: Radu" value={newUser.name}
                onChange={e => setNewUser(n => ({ ...n, name: e.target.value }))} />
            </div>
            <div>
              <label style={s.label}>Parolă</label>
              <input style={s.input} type="text" placeholder="minim 4 caractere" value={newUser.password}
                onChange={e => setNewUser(n => ({ ...n, password: e.target.value }))} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.muted, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={newUser.isAdmin}
                onChange={e => setNewUser(n => ({ ...n, isAdmin: e.target.checked }))} />
              Este admin
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={s.btnPrimary} onClick={addUser}>✅ Creează</button>
              <button style={{ ...s.btnSm, background: C.surface }} onClick={() => setShowAddForm(false)}>Anulează</button>
            </div>
          </div>
        </div>
      ) : (
        <button style={{ ...s.btnSm, alignSelf: 'flex-start', padding: '10px 20px', fontSize: 14 }}
          onClick={() => { setShowAddForm(true); setMsg(null); }}>
          ➕ Adaugă jucător nou
        </button>
      )}
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────────────
function SyncBar({ syncing, syncMsg, lastSync, onSync, full }) {
  return (
    <div style={s.syncBar}>
      <div style={{ flex: 1 }}>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
          Rezultatele sunt preluate automat din{' '}
          <a href="https://github.com/openfootball/worldcup.json" target="_blank" rel="noopener noreferrer"
            style={{ color: C.accent }}>openfootball</a>.
          {full && ' Poți introduce și scoruri manual mai jos.'}
        </p>
        {lastSync && (
          <p style={{ color: C.muted, fontSize: 11, margin: '2px 0 0' }}>
            Ultima sincronizare: {new Date(lastSync).toLocaleString('ro-RO')}
          </p>
        )}
      </div>
      <button style={s.btnSync} onClick={onSync} disabled={syncing}>
        {syncing ? '⏳ Sincronizez...' : '🔄 Actualizează'}
      </button>
      {syncMsg && (
        <span style={{ fontSize: 12, color: syncMsg.startsWith('✅') ? C.accent2 : C.danger }}>
          {syncMsg}
        </span>
      )}
    </div>
  );
}

function FilterRow({ rounds, filter, setFilter }) {
  return (
    <div style={s.filterRow}>
      {rounds.map(r => (
        <button key={r} onClick={() => setFilter(r)}
          style={{ ...s.filterBtn, ...(filter === r ? s.filterBtnActive : {}) }}>
          {r}
        </button>
      ))}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  root: { background: C.bg, minHeight: '100vh', fontFamily: "'Exo 2','Segoe UI',sans-serif", color: C.text },
  main: { maxWidth: 920, margin: '0 auto', padding: '20px 16px 80px' },

  loginBg: { background: `radial-gradient(ellipse at 50% 0%, #0d2040 0%, ${C.bg} 70%)`,
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  loginCard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 20,
    padding: '40px 32px', width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 16,
    boxShadow: '0 24px 64px rgba(0,0,0,0.6)' },
  loginTitle: { fontSize: 38, fontWeight: 900, textAlign: 'center', margin: 0,
    background: `linear-gradient(90deg,${C.accent},${C.accent2})`,
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },

  header: { background: C.surface + 'ee', borderBottom: `1px solid ${C.border}`,
    position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(12px)' },
  headerInner: { maxWidth: 920, margin: '0 auto', padding: '0 16px',
    display: 'flex', alignItems: 'center', gap: 10, height: 56, flexWrap: 'wrap' },
  logo: { fontWeight: 900, fontSize: 16, background: `linear-gradient(90deg,${C.accent},${C.accent2})`,
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', whiteSpace: 'nowrap' },
  nav: { display: 'flex', gap: 2, flex: 1, flexWrap: 'wrap' },
  navBtn: { background: 'none', border: 'none', color: C.muted, cursor: 'pointer',
    padding: '5px 10px', borderRadius: 8, fontSize: 13, fontWeight: 500 },
  navActive: { background: `${C.accent}20`, color: C.accent, fontWeight: 700 },
  btnLogout: { background: 'none', border: `1px solid ${C.border}`, color: C.muted,
    cursor: 'pointer', padding: '4px 10px', borderRadius: 6, fontSize: 12 },

  section: { display: 'flex', flexDirection: 'column', gap: 14 },
  sectionTitle: { fontSize: 22, fontWeight: 900, margin: '0 0 4px',
    background: `linear-gradient(90deg,${C.accent},${C.accent2})`,
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
    padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 },

  syncBar: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
    padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  btnSync: { background: `linear-gradient(90deg,${C.accent},${C.accent2})`,
    border: 'none', borderRadius: 8, color: C.bg, padding: '8px 16px',
    fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  emptyBox: { background: `${C.accent}11`, border: `1px dashed ${C.accent}55`, borderRadius: 12,
    padding: '20px', textAlign: 'center', color: C.muted, fontSize: 14 },

  filterRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  filterBtn: { background: C.card, border: `1px solid ${C.border}`, color: C.muted,
    cursor: 'pointer', padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500 },
  filterBtnActive: { background: `${C.accent}20`, borderColor: C.accent, color: C.accent, fontWeight: 700 },

  matchList: { display: 'flex', flexDirection: 'column', gap: 8 },
  matchCard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
    padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, transition: 'border-color .3s' },
  matchMeta: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  roundBadge: { background: `${C.accent}20`, color: C.accent, fontSize: 10,
    fontWeight: 700, padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase', whiteSpace: 'nowrap' },
  matchRow: { display: 'flex', alignItems: 'center', gap: 10 },
  team: { flex: 1, fontWeight: 600, fontSize: 14 },
  scoreBox: { display: 'flex', alignItems: 'center', gap: 5 },
  scoreIn: { width: 42, textAlign: 'center', background: C.surface, border: `1px solid ${C.accent}44`,
    borderRadius: 7, color: C.text, padding: '5px 3px', fontSize: 18, fontWeight: 700, outline: 'none' },
  scoreStatic: { width: 42, textAlign: 'center', background: C.surface, borderRadius: 7,
    padding: '5px 3px', fontSize: 18, fontWeight: 700, color: C.muted },
  colon: { color: C.muted, fontWeight: 700, fontSize: 16 },
  resultRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: 6, paddingTop: 8, borderTop: `1px solid ${C.border}` },
  badge: { fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10 },

  alertBox: { background: '#ffc83222', border: '1px solid #ffc83266', borderRadius: 10,
    padding: '10px 14px', color: C.warn, fontSize: 13, fontWeight: 600 },
  finSlot: { flex: 1, minWidth: 130, background: C.surface, border: `2px solid ${C.accent}33`,
    borderRadius: 12, padding: '14px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 6, position: 'relative' },
  clearBtn: { position: 'absolute', top: 6, right: 8, background: 'none', border: 'none',
    color: C.danger, cursor: 'pointer', fontSize: 14, fontWeight: 700 },
  teamGrid: { display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 260, overflowY: 'auto' },
  teamBtn: { background: C.surface, border: `1px solid ${C.border}`, color: C.text,
    cursor: 'pointer', padding: '5px 10px', borderRadius: 7, fontSize: 12 },
  teamBtnOn: { background: `${C.accent}25`, borderColor: C.accent, color: C.accent, fontWeight: 700 },

  table: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' },
  tableHead: { display: 'flex', padding: '10px 18px', background: C.surface,
    color: C.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', gap: 6 },
  tableRow: { display: 'flex', padding: '13px 18px', borderTop: `1px solid ${C.border}`, alignItems: 'center', gap: 6 },
  ruleRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0',
    borderBottom: `1px solid ${C.border}` },

  adminRow: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
    padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 },
  adminIn: { width: 46, textAlign: 'center', background: C.surface, border: `1px solid ${C.accent}44`,
    borderRadius: 7, color: C.text, padding: '5px 3px', fontSize: 17, fontWeight: 700, outline: 'none' },

  label: { display: 'block', color: C.muted, fontSize: 12, marginBottom: 5, fontWeight: 600 },
  select: { background: C.surface, border: `1px solid ${C.border}`, color: C.text,
    borderRadius: 8, padding: '8px 10px', fontSize: 13, width: '100%' },
  input: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9,
    color: C.text, padding: '10px 13px', fontSize: 14, outline: 'none',
    width: '100%', boxSizing: 'border-box' },
  btnPrimary: { background: `linear-gradient(90deg,${C.accent},${C.accent2})`,
    border: 'none', borderRadius: 9, color: C.bg, padding: '12px', fontSize: 15,
    fontWeight: 800, cursor: 'pointer', width: '100%' },
  btnSm: { background: `${C.accent}20`, border: `1px solid ${C.accent}44`, color: C.accent,
    borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
};
