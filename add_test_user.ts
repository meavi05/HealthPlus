import db from './db.ts';

const insertUser = db.prepare('INSERT INTO users (email, name) VALUES (?, ?)');
try {
  insertUser.run('test@example.com', 'Test User');
  console.log('Test user added successfully');
} catch (e) {
  console.error('Error adding test user:', e);
}
