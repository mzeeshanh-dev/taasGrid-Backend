import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import userRoutes from "./routes/user.routes.js";
import cvRoutes from "./routes/resume.routes.js";
import studentResumeRoutes from "./routes/studentResume.routes.js";
import applicantRoutes from "./routes/applicant.routes.js";
import jobRoutes from "./routes/job.routes.js";
import internshipsRoutes from "./routes/internships.routes.js";
import fypRoutes from "./routes/fyp.routes.js";
import companyRoutes from "./routes/company.routes.js";
import authRoutes from "./routes/auth.routes.js";
import analyzerRoute from "./routes/analyzer.route.js"
import batchRoutes from "./routes/batch.routes.js"
dotenv.config();

const app = express();

// 🔹 Middleware
// app.use(cors({
//   origin: process.env.FRONTEND_URL,
//   credentials: true,  // very important
// }));
const allowedOrigins = [
  "http://localhost:3000",
  "https://taa-s-grid.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));


app.use(cookieParser())
app.use(express.json());

// 🔹 MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// 🔹 Base Route
app.get("/", (req, res) => {
  res.send("🚀 TaaS Grid API is running...");
});

// 🔹 Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/employee", cvRoutes);
app.use("/api/student", studentResumeRoutes);
app.use("/api/applicants", applicantRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/internships", internshipsRoutes);
app.use("/api/fyps", fypRoutes);
app.use("/api/bundle", analyzerRoute);
app.use("/api/batch", batchRoutes);
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
