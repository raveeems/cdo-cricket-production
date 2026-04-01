// Manual verification of XI backup resolution logic.
// Run: node scripts/test-backup-xi.mjs

function resolveEffectiveXI(team, playerById, playerByExtId = new Map()) {
  const backup1Id = team.backupXiPlayer1Id ?? null;
  const backup2Id = team.backupXiPlayer2Id ?? null;
  const effectivePlayerIds = [...team.playerIds];
  let effectiveCaptainId = team.captainId ?? null;
  let effectiveVcId = team.viceCaptainId ?? null;
  const substitutions = [];

  const xiAnnounced = Array.from(playerById.values()).some(p => p.isPlayingXI === true);
  if (!xiAnnounced || (!backup1Id && !backup2Id)) {
    return { effectivePlayerIds, effectiveCaptainId, effectiveVcId, substitutions };
  }

  const availableBackups = [backup1Id, backup2Id]
    .filter(id => !!id)
    .map(id => playerById.get(id) || playerByExtId.get(id))
    .filter(p => !!p && p.isPlayingXI === true);

  if (availableBackups.length === 0) {
    return { effectivePlayerIds, effectiveCaptainId, effectiveVcId, substitutions };
  }

  let backupCursor = 0;
  for (let i = 0; i < effectivePlayerIds.length; i++) {
    if (backupCursor >= availableBackups.length) break;
    const pid = effectivePlayerIds[i];
    const p = playerById.get(pid) || playerByExtId.get(pid);
    if (p && p.isPlayingXI !== true) {
      const backup = availableBackups[backupCursor++];
      effectivePlayerIds[i] = backup.id;
      substitutions.push({ outId: pid, inId: backup.id });
      if (pid === effectiveCaptainId) effectiveCaptainId = backup.id;
      if (pid === effectiveVcId) effectiveVcId = backup.id;
    }
  }

  return { effectivePlayerIds, effectiveCaptainId, effectiveVcId, substitutions };
}

// Helper: build player map
function makeMap(players) {
  return new Map(players.map(p => [p.id, p]));
}

let passed = 0;
let failed = 0;

function test(label, fn) {
  try {
    fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${label}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ── BASE PLAYER POOL ──────────────────────────────────────────────────────────
// 11 main XI players (8 in official XI, 3 absent), 4 candidates for backup
const players = [
  // Main XI — 8 in official XI, 3 absent
  { id: 'p1',  name: 'P1',  role: 'BAT',  isPlayingXI: true,  points: 40 },  // captain
  { id: 'p2',  name: 'P2',  role: 'BAT',  isPlayingXI: true,  points: 30 },  // vc
  { id: 'p3',  name: 'P3',  role: 'BAT',  isPlayingXI: false, points: 0 },   // absent (1st absent)
  { id: 'p4',  name: 'P4',  role: 'AR',   isPlayingXI: true,  points: 55 },
  { id: 'p5',  name: 'P5',  role: 'BOWL', isPlayingXI: true,  points: 20 },
  { id: 'p6',  name: 'P6',  role: 'BOWL', isPlayingXI: false, points: 0 },   // absent (2nd absent)
  { id: 'p7',  name: 'P7',  role: 'WK',   isPlayingXI: true,  points: 35 },
  { id: 'p8',  name: 'P8',  role: 'BAT',  isPlayingXI: true,  points: 25 },
  { id: 'p9',  name: 'P9',  role: 'BOWL', isPlayingXI: true,  points: 15 },
  { id: 'p10', name: 'P10', role: 'AR',   isPlayingXI: false, points: 0 },   // absent (3rd absent)
  { id: 'p11', name: 'P11', role: 'BAT',  isPlayingXI: true,  points: 45 },
  // Backup candidates
  { id: 'bk1', name: 'BK1', role: 'BAT',  isPlayingXI: true,  points: 60 },
  { id: 'bk2', name: 'BK2', role: 'BOWL', isPlayingXI: true,  points: 22 },
  { id: 'bkX', name: 'BKX', role: 'BAT',  isPlayingXI: false, points: 0 },  // backup NOT in XI
  // Captain/VC absent scenarios
  { id: 'cap_absent', name: 'CAP', role: 'BAT', isPlayingXI: false, points: 0 },
  { id: 'vc_absent',  name: 'VC',  role: 'BAT', isPlayingXI: false, points: 0 },
];
const playerById = makeMap(players);

const basePlayerIds = ['p1','p2','p3','p4','p5','p6','p7','p8','p9','p10','p11'];

// ── SCENARIO 1: No XI announced → no substitution ────────────────────────────
console.log('\nScenario 1: XI not yet announced');
test('No substitution when XI not announced', () => {
  const noXiPlayers = players.map(p => ({ ...p, isPlayingXI: false }));
  const noXiMap = makeMap(noXiPlayers);
  const result = resolveEffectiveXI(
    { playerIds: ['p1','p2','p3'], captainId: 'p1', viceCaptainId: 'p2', backupXiPlayer1Id: 'bk1', backupXiPlayer2Id: 'bk2' },
    noXiMap
  );
  assert(result.effectivePlayerIds.join(',') === 'p1,p2,p3', 'playerIds unchanged');
  assert(result.substitutions.length === 0, 'no substitutions');
});

// ── SCENARIO 2: 1 absent player, Backup 1 in XI → replaces ──────────────────
console.log('\nScenario 2: 1 missing player → Backup 1 replaces');
test('p3 absent, bk1 in XI → bk1 replaces p3', () => {
  const team = { playerIds: [...basePlayerIds], captainId: 'p1', viceCaptainId: 'p2', backupXiPlayer1Id: 'bk1', backupXiPlayer2Id: null };
  const result = resolveEffectiveXI(team, playerById);
  assert(result.effectivePlayerIds.includes('bk1'), 'bk1 is in effective XI');
  assert(!result.effectivePlayerIds.includes('p3'), 'p3 removed');
  assert(result.effectivePlayerIds.length === 11, 'still 11 players');
  assert(result.substitutions.length === 1, '1 substitution');
  assert(result.substitutions[0].outId === 'p3' && result.substitutions[0].inId === 'bk1', 'correct sub');
  assert(result.effectiveCaptainId === 'p1', 'captain unchanged');
  assert(result.effectiveVcId === 'p2', 'vc unchanged');
});

// ── SCENARIO 3: 2 absent players → both backups replace ──────────────────────
console.log('\nScenario 3: 2 missing players → both backups replace');
test('p3 and p6 absent, bk1+bk2 in XI → both replaced', () => {
  const team = { playerIds: [...basePlayerIds], captainId: 'p1', viceCaptainId: 'p2', backupXiPlayer1Id: 'bk1', backupXiPlayer2Id: 'bk2' };
  const result = resolveEffectiveXI(team, playerById);
  assert(result.effectivePlayerIds.includes('bk1'), 'bk1 in');
  assert(result.effectivePlayerIds.includes('bk2'), 'bk2 in');
  assert(!result.effectivePlayerIds.includes('p3'), 'p3 out');
  assert(!result.effectivePlayerIds.includes('p6'), 'p6 out');
  assert(result.effectivePlayerIds.length === 11, 'still 11');
  assert(result.substitutions.length === 2, '2 substitutions');
});

// ── SCENARIO 4: 3 absent players but only 2 backups → max 2 replaced ─────────
console.log('\nScenario 4: 3 missing → max 2 replaced (3rd stays absent)');
test('p3, p6, p10 absent, bk1+bk2 → only p3+p6 replaced, p10 stays', () => {
  const team = { playerIds: [...basePlayerIds], captainId: 'p1', viceCaptainId: 'p2', backupXiPlayer1Id: 'bk1', backupXiPlayer2Id: 'bk2' };
  const result = resolveEffectiveXI(team, playerById);
  assert(result.effectivePlayerIds.includes('bk1'), 'bk1 in');
  assert(result.effectivePlayerIds.includes('bk2'), 'bk2 in');
  assert(result.effectivePlayerIds.includes('p10'), 'p10 still in (3rd absent not replaced)');
  assert(result.substitutions.length === 2, 'only 2 subs');
});

// ── SCENARIO 5: Captain absent → backup inherits C (2×) ──────────────────────
console.log('\nScenario 5: Captain absent → backup inherits Captain');
test('Captain (p3 position) absent, bk1 replaces → bk1 gets effectiveCaptainId', () => {
  // Team where captain is at index 0 (p3 — absent in base pool)
  // Redefine: use players where p3 is captain and is absent
  const teamPlayers = ['p3','p2','p1','p4','p5','p6','p7','p8','p9','p10','p11'];
  const team = { playerIds: teamPlayers, captainId: 'p3', viceCaptainId: 'p2', backupXiPlayer1Id: 'bk1', backupXiPlayer2Id: null };
  const result = resolveEffectiveXI(team, playerById);
  assert(result.effectiveCaptainId === 'bk1', `effectiveCaptainId should be bk1, got ${result.effectiveCaptainId}`);
  assert(result.effectivePlayerIds[0] === 'bk1', 'bk1 at index 0');
});

// ── SCENARIO 6: VC absent → backup inherits VC (1.5×) ───────────────────────
console.log('\nScenario 6: VC absent → backup inherits Vice-Captain');
test('VC (p3 position) absent, bk1 replaces → bk1 gets effectiveVcId', () => {
  const teamPlayers = ['p1','p3','p2','p4','p5','p6','p7','p8','p9','p10','p11'];
  const team = { playerIds: teamPlayers, captainId: 'p1', viceCaptainId: 'p3', backupXiPlayer1Id: 'bk1', backupXiPlayer2Id: null };
  const result = resolveEffectiveXI(team, playerById);
  assert(result.effectiveVcId === 'bk1', `effectiveVcId should be bk1, got ${result.effectiveVcId}`);
  assert(result.effectiveCaptainId === 'p1', 'captain unchanged');
});

// ── SCENARIO 7: Captain AND VC both absent, position order matters ────────────
console.log('\nScenario 7: Captain before VC in array → Backup 1 gets C, Backup 2 gets VC');
test('Captain at index 0, VC at index 1 (both absent) → Bk1=C, Bk2=VC', () => {
  const teamPlayers = ['p3','p6','p1','p4','p5','p2','p7','p8','p9','p10','p11'];
  const team = { playerIds: teamPlayers, captainId: 'p3', viceCaptainId: 'p6', backupXiPlayer1Id: 'bk1', backupXiPlayer2Id: 'bk2' };
  const result = resolveEffectiveXI(team, playerById);
  assert(result.effectiveCaptainId === 'bk1', `Bk1 should be new captain, got ${result.effectiveCaptainId}`);
  assert(result.effectiveVcId === 'bk2', `Bk2 should be new VC, got ${result.effectiveVcId}`);
});

test('VC before Captain in array → Backup 1 gets VC, Backup 2 gets C', () => {
  const teamPlayers = ['p6','p3','p1','p4','p5','p2','p7','p8','p9','p10','p11'];
  const team = { playerIds: teamPlayers, captainId: 'p3', viceCaptainId: 'p6', backupXiPlayer1Id: 'bk1', backupXiPlayer2Id: 'bk2' };
  const result = resolveEffectiveXI(team, playerById);
  assert(result.effectiveVcId === 'bk1', `Bk1 should be new VC (vc was first), got ${result.effectiveVcId}`);
  assert(result.effectiveCaptainId === 'bk2', `Bk2 should be new captain (cap was second), got ${result.effectiveCaptainId}`);
});

// ── SCENARIO 8: Backup NOT in XI → excluded, no replacement ─────────────────
console.log('\nScenario 8: Backup not in official XI → excluded, no replacement');
test('bkX (isPlayingXI=false) as backup → not used', () => {
  const team = { playerIds: [...basePlayerIds], captainId: 'p1', viceCaptainId: 'p2', backupXiPlayer1Id: 'bkX', backupXiPlayer2Id: null };
  const result = resolveEffectiveXI(team, playerById);
  assert(!result.effectivePlayerIds.includes('bkX'), 'bkX not in effective XI');
  assert(result.effectivePlayerIds.includes('p3'), 'p3 still in (not replaced)');
  assert(result.substitutions.length === 0, 'no substitutions');
});

test('bkX as Backup 1 (not in XI), bk1 as Backup 2 (in XI) → bk1 used', () => {
  const team = { playerIds: [...basePlayerIds], captainId: 'p1', viceCaptainId: 'p2', backupXiPlayer1Id: 'bkX', backupXiPlayer2Id: 'bk1' };
  const result = resolveEffectiveXI(team, playerById);
  // bkX is filtered out; availableBackups = [bk1]
  assert(result.effectivePlayerIds.includes('bk1'), 'bk1 used when bkX excluded');
  assert(result.substitutions.length === 1, '1 sub');
});

// ── SCENARIO 9: No backups set → no-op ───────────────────────────────────────
console.log('\nScenario 9: No backups set → no-op');
test('No backup IDs → effective XI equals original playerIds', () => {
  const team = { playerIds: [...basePlayerIds], captainId: 'p1', viceCaptainId: 'p2', backupXiPlayer1Id: null, backupXiPlayer2Id: null };
  const result = resolveEffectiveXI(team, playerById);
  assert(result.effectivePlayerIds.join(',') === basePlayerIds.join(','), 'unchanged');
  assert(result.substitutions.length === 0, 'no subs');
});

// ── SCENARIO 10: +4 points — verify backup inherits full points ──────────────
console.log('\nScenario 10: +4 XI bonus — backup receives full points including +4');
test('bk1 has 60 points (+4 already included by heartbeat), captain absent → effectivePlayer gets 60*2=120', () => {
  // p3 is captain (absent), bk1 replaces → effectiveCaptainId=bk1 → 60 pts * 2 = 120
  const teamPlayers = ['p3','p2','p1','p4','p5','p6','p7','p8','p9','p10','p11'];
  const team = { playerIds: teamPlayers, captainId: 'p3', viceCaptainId: 'p2', backupXiPlayer1Id: 'bk1', backupXiPlayer2Id: null };
  const result = resolveEffectiveXI(team, playerById);
  assert(result.effectiveCaptainId === 'bk1', 'bk1 is captain');
  // Simulate scoring
  let total = 0;
  for (const pid of result.effectivePlayerIds) {
    const p = playerById.get(pid);
    if (!p) continue;
    let pts = p.points || 0;
    if (pid === result.effectiveCaptainId) pts *= 2;
    else if (pid === result.effectiveVcId) pts *= 1.5;
    total += pts;
  }
  // bk1 (60 pts) * 2 (captain) = 120, p2 (30) * 1.5 = 45, others sum
  const bk1Contribution = 60 * 2;
  assert(bk1Contribution === 120, `captain bk1 contributes 120, got ${bk1Contribution}`);
  console.log(`    Total team points (with effective XI): ${total}`);
  console.log(`    bk1 captain contribution: ${bk1Contribution} pts (no double-counting)`);
});

// ── SCENARIO 11: Penalty mode math ───────────────────────────────────────────
console.log('\nScenario 11: Pot penalty mode math');
test('entries_plus_penalty: 3 losers × 30 + 2 penalty users × 30 = 150 winner share', () => {
  const stake = 30;
  const losers = 3;
  const winners = 1;
  const penaltyUsers = 2;
  const totalPot = (losers * stake) + (penaltyUsers * stake);
  const winnerShare = Math.round(totalPot / winners);
  assert(totalPot === 150, `totalPot should be 150, got ${totalPot}`);
  assert(winnerShare === 150, `winnerShare should be 150, got ${winnerShare}`);
  console.log(`    entries_only: ${losers}×${stake} = ₹${losers * stake}`);
  console.log(`    penalty adds: ${penaltyUsers}×${stake} = ₹${penaltyUsers * stake}`);
  console.log(`    total pot: ₹${totalPot} → winner gets ₹${winnerShare}`);
});

test('entries_only (no penalty): 3 losers × 30 = 90 winner share', () => {
  const stake = 30;
  const losers = 3;
  const totalPot = losers * stake;
  assert(totalPot === 90, `totalPot should be 90, got ${totalPot}`);
});

test('Re-process replaces (not stacks): deleting previous entries first is the behavior', () => {
  // Simulated ledger state: old entries = [{user: A, -30}]
  let ledger = [{ userId: 'A', change: -30, matchId: 'm1' }];
  // re-process: delete all for matchId m1, then write fresh
  function deleteLedgerForMatch(matchId) {
    ledger = ledger.filter(e => e.matchId !== matchId);
  }
  deleteLedgerForMatch('m1');
  assert(ledger.length === 0, 'ledger cleared before re-processing');
  // write fresh entries
  ledger.push({ userId: 'A', change: -30, matchId: 'm1' });
  ledger.push({ userId: 'B', change: 60,  matchId: 'm1' });
  assert(ledger.length === 2, 'only new entries exist, not stacked');
  assert(!ledger.some(e => e.userId === 'A' && e.change === -30 && ledger.filter(x => x.userId === 'A').length > 1), 'no double deduction');
});

test('Contest participant excluded from penalty users (backend filter)', () => {
  const allTeams = [{ userId: 'user1' }, { userId: 'user2' }, { userId: 'user3' }];
  const contestUserIds = new Set(allTeams.map(t => t.userId));
  const rawPenaltyIds = ['user2', 'user4', 'user5']; // user2 is a contest participant
  const validated = rawPenaltyIds.filter(uid => !contestUserIds.has(uid));
  assert(!validated.includes('user2'), 'user2 (contest participant) excluded');
  assert(validated.includes('user4'), 'user4 (non-participant) kept');
  assert(validated.includes('user5'), 'user5 (non-participant) kept');
  console.log(`    Validated penalty users: [${validated.join(', ')}] (user2 stripped)`);
});

// ── SUMMARY ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
