import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// Like checkAuth, but never blocks the request. If a valid bearer token is
// present, req.user is populated; otherwise req.user is left null and the
// request continues as a guest. Used by endpoints that work for everyone but
// offer extra (saved) behavior when logged in — e.g. the Daily News Quiz.
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token || token === 'null' || token === 'undefined') {
    req.user = null;
    return next();
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    req.user = err ? null : user;
    next();
  });
};

export default optionalAuth;
