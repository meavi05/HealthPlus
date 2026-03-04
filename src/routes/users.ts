import express from 'express';
import db from '../../db';

const router = express.Router();

router.get('/:userId', (req, res) => {
  const { userId } = req.params;
  const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(userId);
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ message: 'User not found' });
  }
});

router.put('/:userId', (req, res) => {
  const { userId } = req.params;
  const { name, email, profile_picture } = req.body;
  
  // Basic validation
  if (!email || !name) {
    return res.status(400).json({ message: 'Name and email are required' });
  }

  try {
    // Check if column exists, if not, add it (simplified)
    try {
      db.prepare('ALTER TABLE users ADD COLUMN profile_picture TEXT').run();
    } catch (e) {
      // Column might already exist
    }

    const update = db.prepare('UPDATE users SET name = ?, email = ?, profile_picture = ? WHERE id = ?');
    update.run(name, email, profile_picture, userId);
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile' });
  }
});

export default router;
