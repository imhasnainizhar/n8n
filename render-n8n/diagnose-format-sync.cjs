const { Client } = require('pg');
(async () => {
  const c = new Client({
    host: process.env.DB_POSTGRESDB_HOST,
    port: Number(process.env.DB_POSTGRESDB_PORT || 5432),
    user: process.env.DB_POSTGRESDB_USER,
    password: process.env.DB_POSTGRESDB_PASSWORD,
    database: process.env.DB_POSTGRESDB_DATABASE,
    ssl: false,
  });
  try {
    await c.connect();
    const ex = await c.query('SELECT id,status,"startedAt","stoppedAt" FROM execution_entity WHERE "workflowId"=$1 ORDER BY id DESC LIMIT 8', ['NtnGCalSyncA0001']);
    console.log('FORMAT_DIAG_EXEC', JSON.stringify(ex.rows));
    for (const e of ex.rows.slice(0,6)) {
      const r = await c.query('SELECT data FROM execution_data WHERE "executionId"=$1', [e.id]);
      if (!r.rows.length) continue;
      const raw = String(r.rows[0].data || '');
      const names = ['Supported Task Event?','Fetch Notion Page','Extract Task Fields','Syncable Task?','Choose Sync Action','Create Event?','Create Google Event','Update Event?','Update Google Event','Write Sync Metadata to Notion'];
      const hit = names.filter(n => raw.includes(n));
      const snippets = [];
      for (const re of [/error.{0,500}/gi,/message.{0,500}/gi,/lastNodeExecuted.{0,160}/g]) {
        for (const m of raw.matchAll(re)) snippets.push(m[0]);
      }
      console.log('FORMAT_DIAG_DATA', JSON.stringify({id:e.id,nodes:hit,snippets:snippets.slice(0,10),bytes:raw.length}));
    }
  } catch (e) { console.log('FORMAT_DIAG_FATAL', e.message); }
  finally { try { await c.end(); } catch {} }
})();
