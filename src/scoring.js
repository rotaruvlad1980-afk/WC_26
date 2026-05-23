// ─── Scoring logic ────────────────────────────────────────────────────────────

export function getResult(h, a) {
  if (h > a) return 'H';
  if (h < a) return 'A';
  return 'D';
}

/**
 * Calculate points for one player.
 * @param {Object} preds       - { matchId: { home, away } }
 * @param {Object} results     - { matchId: { home, away } }  (real scores)
 * @param {string[]} finalistPred   - [team1, team2] predicted finalists
 * @param {string[]} actualFinalists - [team1, team2] real finalists
 * @param {Array}   matches    - all match objects
 * @returns {{ pts, exact, penalties }}
 */
export function calcPoints(preds, results, finalistPred, actualFinalists, matches) {
  let pts = 0, exact = 0, penalties = 0;

  matches.forEach(m => {
    const r = results[m.id];
    if (!r || r.home === '' || r.away === '' || r.home == null || r.away == null) return;

    const p = preds?.[m.id];
    if (!p || p.home === '' || p.away === '' || p.home == null || p.away == null) {
      penalties++;
      pts--;
      return;
    }

    const ph = parseInt(p.home), pa = parseInt(p.away);
    const rh = parseInt(r.home), ra = parseInt(r.away);

    if (isNaN(ph) || isNaN(pa)) { penalties++; pts--; return; }

    if (ph === rh && pa === ra) { pts += 3; exact++; }
    else if (getResult(ph, pa) === getResult(rh, ra)) { pts += 1; }
  });

  // Finalists bonus — 1 pt each, +1 bonus if both correct (total 3 pts)
  if (actualFinalists?.length === 2 && finalistPred?.length === 2) {
    let hits = 0;
    finalistPred.forEach(t => {
      if (t && actualFinalists.includes(t)) { pts += 1; hits++; }
    });
    if (hits === 2) pts += 1; // bonus: 1+1+1 = 3 pts total
  }

  return { pts, exact, penalties };
}
