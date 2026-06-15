// Admin gate for maintenance endpoints (e.g. regenerating the daily quiz).
// The user model has no admin role, so this checks a shared secret instead:
// set QUIZ_ADMIN_KEY in backend/.env and send it as the `x-admin-key` header.
// Runs AFTER checkAuth, so the caller must also be a logged-in user.

const checkAdmin = (req, res, next) => {
  const configured = (process.env.QUIZ_ADMIN_KEY || '').trim();
  if (!configured) {
    return res.status(503).json({ success: false, message: 'Admin actions are disabled — QUIZ_ADMIN_KEY is not set on the server.' });
  }
  if ((req.headers['x-admin-key'] || '').trim() !== configured) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  next();
};

export default checkAdmin;
