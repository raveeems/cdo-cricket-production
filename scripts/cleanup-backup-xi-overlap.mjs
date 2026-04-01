/**
 * cleanup-backup-xi-overlap.mjs
 *
 * One-time cleanup script: finds and auto-clears any saved backup_xi_player_1_id or
 * backup_xi_player_2_id values that overlap with the team's own player_ids array.
 *
 * Root cause context:
 *   The PUT /api/teams/:id endpoint previously carried forward existing backup values
 *   without re-validating them against a newly submitted player list.  A user could
 *   save B1=D.Miller (valid), then edit their XI to include D.Miller without touching
 *   the backup field — the carried-over backup was never re-checked.
 *
 * Usage:
 *   DRY RUN (see what would be fixed, no DB writes):
 *     node scripts/cleanup-backup-xi-overlap.mjs
 *
 *   APPLY FIX:
 *     node scripts/cleanup-backup-xi-overlap.mjs --apply
 *
 * Requires DATABASE_URL in environment (same as the app).
 */

import pg from 'pg';

const { Pool } = pg;
const DRY_RUN = !process.argv.includes('--apply');

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log(`\n=== Backup XI Overlap Cleanup === ${DRY_RUN ? '[DRY RUN]' : '[APPLYING FIXES]'}\n`);

  // 1. Find all teams where b1 or b2 overlaps with player_ids
  const { rows: overlapping } = await pool.query(`
    SELECT
      t.id,
      t.backup_xi_player_1_id AS b1,
      t.backup_xi_player_2_id AS b2,
      t.player_ids,
      u.username
    FROM user_teams t
    JOIN users u ON u.id = t.user_id
    WHERE
      (t.backup_xi_player_1_id IS NOT NULL
        AND t.player_ids @> to_jsonb(t.backup_xi_player_1_id))
      OR
      (t.backup_xi_player_2_id IS NOT NULL
        AND t.player_ids @> to_jsonb(t.backup_xi_player_2_id))
    ORDER BY u.username, t.id
  `);

  if (overlapping.length === 0) {
    console.log('✅ No overlapping backup/XI teams found. Database is clean.\n');
    await pool.end();
    return;
  }

  console.log(`⚠️  Found ${overlapping.length} team(s) with illegal backup/XI overlap:\n`);

  for (const row of overlapping) {
    const playerIds = Array.isArray(row.player_ids) ? row.player_ids : [];
    const b1InXI = row.b1 && playerIds.includes(row.b1);
    const b2InXI = row.b2 && playerIds.includes(row.b2);

    console.log(`  Team ${row.id} (user: ${row.username})`);
    if (b1InXI) console.log(`    B1=${row.b1} is already in main XI → will clear`);
    if (b2InXI) console.log(`    B2=${row.b2} is already in main XI → will clear`);

    if (!DRY_RUN) {
      const updates = [];
      const values = [row.id];
      if (b1InXI) { updates.push(`backup_xi_player_1_id = NULL`); }
      if (b2InXI) { updates.push(`backup_xi_player_2_id = NULL`); }
      if (updates.length > 0) {
        await pool.query(
          `UPDATE user_teams SET ${updates.join(', ')} WHERE id = $1`,
          values
        );
        console.log(`    ✅ Fixed`);
      }
    }
  }

  // 2. Also find teams where b1 === b2 (both same player — also invalid)
  const { rows: sameBoth } = await pool.query(`
    SELECT t.id, t.backup_xi_player_1_id AS b1, t.backup_xi_player_2_id AS b2, u.username
    FROM user_teams t
    JOIN users u ON u.id = t.user_id
    WHERE t.backup_xi_player_1_id IS NOT NULL
      AND t.backup_xi_player_1_id = t.backup_xi_player_2_id
    ORDER BY u.username
  `);

  if (sameBoth.length > 0) {
    console.log(`\n⚠️  Found ${sameBoth.length} team(s) where B1 === B2 (must be different):\n`);
    for (const row of sameBoth) {
      console.log(`  Team ${row.id} (user: ${row.username}): B1=B2=${row.b1} → will clear B2`);
      if (!DRY_RUN) {
        await pool.query(
          `UPDATE user_teams SET backup_xi_player_2_id = NULL WHERE id = $1`,
          [row.id]
        );
        console.log(`    ✅ Fixed`);
      }
    }
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes written. Re-run with --apply to fix.\n');
  } else {
    console.log('\n✅ All fixes applied.\n');
  }

  await pool.end();
}

run().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
