// models/company.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const companySchema = new mongoose.Schema(
  {
    companyName: { type: String, required: [true, "Company name is required"], trim: true, index: true },
    email: { type: String, required: [true, "Email is required"], unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: [true, "Password is required"] },
    phone: { type: String },
    address: { type: String },
    website: { type: String },
    description: { type: String },
    industry: { type: String },
    size: { type: String, default: "1-10 employees" },
    plan: { type: String, enum: ["basic", "premium"], default: "basic" },
    refreshToken: { type: String }, // hashed refresh token stored
    establishedYear: { type: Number, min: 1800, max: new Date().getFullYear() },
    logo: { type: String }, // url or path
  },
  { timestamps: true }
);

// Hash password before saving
companySchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare passwords
companySchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Generate Access Token (short lived)
companySchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { _id: this._id, email: this.email, companyName: this.companyName },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m" }
  );
};

// Generate Refresh Token (long lived, but we WILL hash it before saving)
companySchema.methods.generateRefreshToken = function () {
  return jwt.sign({ _id: this._id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d",
  });
};

const Company = mongoose.model("Company", companySchema);
export default Company;
