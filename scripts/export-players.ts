import { db } from '../server/db';
import { players } from '../shared/schema';

async function main() {
  try {
    const result = await db.select({
      playerId: players.id,
      playerName: players.name,
      teamName: players.team,
      teamShortName: players.teamShort,
      role: players.role,
      credits: players.credits,
      points: players.points,
    })
    .from(players)
    .orderBy(players.team, players.name);

    console.log('\n====== IPL PLAYER LIST (FLAT TABLE) ======\n');
    console.log(`Total players: ${result.length}\n`);
    
    if (result.length === 0) {
      console.log('No players in database. Syncing with API first...\n');
      process.exit(0);
    }
    
    // Print as formatted table
    console.log(
      'Team'.padEnd(25) +
      'Short'.padEnd(8) +
      'Player ID'.padEnd(36) +
      'Player Name'.padEnd(25) +
      'Role'.padEnd(8) +
      'Credits'
    );
    console.log('='.repeat(120));
    
    let currentTeam = '';
    for (const p of result) {
      if (currentTeam !== p.teamName) {
        currentTeam = p.teamName;
        console.log('');
      }
      
      console.log(
        (p.teamName || '-').padEnd(25) +
        (p.teamShortName || '-').padEnd(8) +
        (p.playerId || '-').padEnd(36) +
        (p.playerName || '-').padEnd(25) +
        (p.role || '-').padEnd(8) +
        String(p.credits || '-')
      );
    }
    
    console.log('\n\n====== JSON FORMAT (for spreadsheet import) ======\n');
    console.log(JSON.stringify(result, null, 2));
    
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

main();
