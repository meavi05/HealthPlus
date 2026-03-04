import express from 'express';
import db from '../../db';

const router = express.Router();

router.get('/:userId', (req, res) => {
  const { userId } = req.params;
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ?').all(userId);
  
  const ordersWithItems = orders.map(order => {
    const items = db.prepare(`
      SELECT oi.*, m.name as medicine_name 
      FROM order_items oi 
      JOIN medicines m ON oi.medicine_id = m.id 
      WHERE oi.order_id = ?
    `).all(order.id);
    return { ...order, items };
  });
  
  res.json(ordersWithItems);
});

router.post('/', (req, res) => {
  const { user_id, items, total_price } = req.body;
  const insertOrder = db.prepare('INSERT INTO orders (user_id, total_price) VALUES (?, ?)');
  const order = insertOrder.run(user_id, total_price);
  const orderId = order.lastInsertRowid;
  
  const insertOrderItem = db.prepare('INSERT INTO order_items (order_id, medicine_id, quantity, price) VALUES (?, ?, ?, ?)');
  const insertMany = db.transaction((items) => {
    for (const item of items) {
      insertOrderItem.run(orderId, item.medicine_id, item.quantity, item.price);
    }
  });
  insertMany(items);
  
  res.status(201).json({ orderId });
});

export default router;
