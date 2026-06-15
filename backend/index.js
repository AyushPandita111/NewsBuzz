import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import checkAuth from './middleware/checkAuth.js';
import userroute from './routes/ruser.js';
import quicksearchroute from './routes/rquicksearch.js';
import providerroute from './routes/rNewsProvider.js';
import quiz_router from './routes/rquiz.js';
import sendemailroute from './routes/rsendemail.js';
import feedroute from './routes/rfeed.js';
import newsroute from './routes/rnews.js';
import { getCategories } from './controllers/cnews.js';
import { startNewsScheduler } from './algorithms/newsAggregator.js';
import { startQuizScheduler } from './algorithms/quizGenerator.js';
import { getQuizMeta } from './controllers/cdailyquiz.js';
import userdoroute from './routes/ruserdo.js';
import path from 'path';
import { fileURLToPath } from 'url';

import dns from 'dns';
// Force Node to use Google DNS to bypass local network SRV query blocking
dns.setServers(['8.8.8.8', '8.8.4.4']);

const app = express();

dotenv.config();

// Create __dirname for ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = process.env.PORT || 9000;

app.use(express.static(path.join(__dirname, '../frontend/build')));
// Serve static files from the React app

mongoose.connect(process.env.MONGO_URL).then(() => {
  console.log("connected to mongodb");
}).catch((err) => {
  console.log(`${err} \n error connecting mongoDB `);
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "authorization"],
  credentials: true,
}));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.get("/api/checkauth", checkAuth, (req, res) => {
  res.status(200).json({ success: true, message: "Authorized", user: req.user });
});
app.use("/api/user", userroute);
app.use("/api/sendemail", sendemailroute);
app.use("/api/quicksearch", checkAuth, quicksearchroute);
app.use("/api/provider", checkAuth, providerroute);
app.get("/api/quiz/meta", getQuizMeta); // public — is today's quiz live? (homepage banner)
app.use("/api/quiz", quiz_router); // auth applied per-route (play is open to guests)
app.use("/api/myfeed", checkAuth, feedroute);
app.use("/api/news", newsroute); // public multi-source feed + AI glance/chat (no auth)
app.get("/api/categories", getCategories); // public list of category names
app.use("/api/userdo", checkAuth, userdoroute);
app.get('/',(req,res)=> {res.status(202).send("Hello Backend myproject1")});

app.listen(port, () => {
  console.log(`listening at port : ${port}`);
  // Warm the homepage cache immediately, then refresh every 15 minutes.
  startNewsScheduler();
  // Daily News Quiz: seed badges, schedule 5 AM generation + startup catch-up.
  startQuizScheduler();
});