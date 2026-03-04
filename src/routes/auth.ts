import express from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import db from '../../db';

const router = express.Router();

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.APP_URL}/api/auth/google/callback`
  }, (accessToken, refreshToken, profile, done) => {
    let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(profile.id);
    if (!user) {
      const insertUser = db.prepare('INSERT INTO users (google_id, name, email) VALUES (?, ?, ?)');
      const result = insertUser.run(profile.id, profile.displayName, profile.emails?.[0].value);
      user = { id: result.lastInsertRowid, google_id: profile.id, name: profile.displayName, email: profile.emails?.[0].value };
    }
    return done(null, user);
  }));

  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
  router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
    res.redirect('/');
  });
}

if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
  passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    callbackURL: `${process.env.APP_URL}/api/auth/facebook/callback`,
    profileFields: ['id', 'displayName', 'emails']
  }, (accessToken, refreshToken, profile, done) => {
    let user = db.prepare('SELECT * FROM users WHERE facebook_id = ?').get(profile.id);
    if (!user) {
      const insertUser = db.prepare('INSERT INTO users (facebook_id, name, email) VALUES (?, ?, ?)');
      const result = insertUser.run(profile.id, profile.displayName, profile.emails?.[0].value);
      user = { id: result.lastInsertRowid, facebook_id: profile.id, name: profile.displayName, email: profile.emails?.[0].value };
    }
    return done(null, user);
  }));

  router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
  router.get('/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/login' }), (req, res) => {
    res.redirect('/');
  });
}

router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) { return res.status(500).json({ message: 'Error logging out' }); }
    res.redirect('/');
  });
});

export default router;
