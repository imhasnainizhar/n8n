const { Client } = require('pg');

(async () => {
  const client = new Client({
    host: process.env.DB_POSTGRESDB_HOST,
    port: Number(process.env.DB_POSTGRESDB_PORT || 5432),
    user: process.env.DB_POSTGRESDB_USER,
    password: process.env.DB_POSTGRESDB_PASSWORD,
    database: process.env.DB_POSTGRESDB_DATABASE,
    ssl: false,
  });
  try {
    await client.connect();
    console.log('SYNC_DIAG_BEGIN');
    const wf = await client.query('SELECT id, name, active, nodes, connections FROM workflow_entity WHERE id = $1', ['NtnGCalSyncA0001']);
    if (!wf.rows.length) {
      console.log('SYNC_DIAG_WORKFLOW_NOT_FOUND');
      return;
    }
    const row = wf.rows[0];
    let nodes = row.nodes;
    if (typeof nodes === 'string') nodes = JSON.parse(nodes);
    console.log('SYNC_DIAG_WORKFLOW', JSON.stringify({ id: row.id, name: row.name, active: row.active }));
    for (const n of nodes || []) {
      const creds = {};
      for (const [type, c] of Object.entries(n.credentials || {})) {
        creds[type] = { id: c && c.id, name: c && c.name };
      }
      if (Object.keys(creds).length || ['Notion Webhook','Verification Request?','Supported Task Event?','Fetch Notion Page','Task Database?','Extract Task Fields','Syncable Task?','Choose Sync Action','Create Event?','Create Google Event','Update Google Event','Delete Old Google Event','Create Moved Google Event','Write Sync Metadata to Notion'].includes(n.name)) {
        console.log('SYNC_DIAG_NODE', JSON.stringify({ name: n.name, credentials: creds }));
      }
    }
    const ex = await client.query('SELECT id, status, "startedAt", "stoppedAt", mode FROM execution_entity WHERE "workflowId" = $1 ORDER BY id DESC LIMIT 12', ['NtnGCalSyncA0001']);
    console.log('SYNC_DIAG_EXECUTIONS', JSON.stringify(ex.rows));
    for (const e of ex.rows.slice(0, 6)) {
      try {
        const dres = await client.query('SELECT data FROM execution_data WHERE "executionId" = $1', [e.id]);
        if (!dres.rows.length) continue;
        const raw = String(dres.rows[0].data || '');
        const found = [];
        const names = ['Verification Request?','Supported Task Event?','Set Page ID','Fetch Notion Page','Task Database?','Extract Task Fields','Syncable Task?','Choose Sync Action','Create Event?','Create Google Event','Update Event?','Update Google Event','Move Event?','Delete Old Google Event','Create Moved Google Event','Write Sync Metadata to Notion'];
        for (const name of names) if (raw.includes(name)) found.push(name);
        const lastMatches = [...raw.matchAll(/lastNodeExecuted.{0,120}/g)].slice(0,3).map(m=>m[0]);
        const errorMatches = [...raw.matchAll(/(?:error|message).{0,220}/gi)].slice(0,5).map(m=>m[0].replace(/Authorization[^,}]*/gi,'Authorization:[redacted]'));
        console.log('SYNC_DIAG_EXEC_DATA', JSON.stringify({ id: e.id, nodesMentioned: found, last: lastMatches, errors: errorMatches, bytes: raw.length }));
      } catch (err) {
        console.log('SYNC_DIAG_EXEC_DATA_ERROR', JSON.stringify({ id: e.id, message: err.message }));
      }
    }
    console.log('SYNC_DIAG_END');
  } catch (err) {
    console.log('SYNC_DIAG_FATAL', err && err.message ? err.message : String(err));
  } finally {
    try { await client.end(); } catch {}
  }
})();
