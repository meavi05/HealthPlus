import Database from 'better-sqlite3';
import fs from 'fs';

const db = new Database('health_plus_store.db');

// Initialize tables if they don't exist
const schema = fs.readFileSync('schema.sql', 'utf8');
db.exec(schema);

export default db;
