import postgres from 'postgres';

const sql = postgres('postgresql://postgres:BENFICA%21kiko1@db.zbinzczztutsnqqikgrm.supabase.co:6543/postgres', {
  connect_timeout: 30,
});

try {
  const result = await sql`SELECT 1 as test`;
  console.log('Connected!', result);
  await sql.end();
} catch (e) {
  console.log('Error:', e.message);
  process.exit(1);
}
