import express from 'express';
import db from '../../db';

const router = express.Router();

router.get('/', (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const offset = (page - 1) * limit;
  const rows = db.prepare('SELECT * FROM medicines LIMIT ? OFFSET ?').all(limit, offset);
  const total = db.prepare('SELECT COUNT(*) as count FROM medicines').get().count;
  res.json({ medicines: rows, total, page, limit });
});

export default router;
