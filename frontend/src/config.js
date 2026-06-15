

// BACKEND_API is read from the build-time env var REACT_APP_BACKEND_API
// (set this in Vercel to your Render backend URL, e.g.
// https://your-app.onrender.com). It falls back to localhost for local dev.
const config = {
  BACKEND_API: process.env.REACT_APP_BACKEND_API || 'http://localhost:9000',
  PWD_SECRET: 'news-aggregator-secret'
};


export default config