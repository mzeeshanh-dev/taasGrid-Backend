import jwt from "jsonwebtoken";
import User from "../models/user.js";
import Company from "../models/company.js";

// -------------------- Cookie Options -------------------- //
const getCookieOptions = (maxAge) => {
  // const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge,
  };
};

const clearCookieOptions = () => {
  // const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
  };
};

// -------------------- Generate Tokens -------------------- //
const generateTokens = (id, role) => {
  const accessToken = jwt.sign(
    { id, role },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN }
  );

  const refreshToken = jwt.sign(
    { id, role },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN }
  );

  return { accessToken, refreshToken };
};

// -------------------- Login -------------------- //
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    let user = await Company.findOne({ email });
    let role = "company";

    if (!user) {
      user = await User.findOne({ email });
      role = user?.role || "student";
    }

    if (!user)
      return res.status(400).json({ message: "Invalid email or password" });

    const valid = await user.isPasswordCorrect(password);
    if (!valid)
      return res.status(400).json({ message: "Invalid email or password" });

    const { accessToken, refreshToken } = generateTokens(user._id, role);

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    // Keep cookies for legacy clients
    res.cookie("accessToken", accessToken, getCookieOptions(15 * 60 * 1000));
    res.cookie("refreshToken", refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000));

    const payload =
      role === "company"
        ? {
          _id: user._id,
          companyName: user.companyName,
          email: user.email,
          role,
          plan: user.plan,
        }
        : {
          _id: user._id,
          name: user.fullName,
          email: user.email,
          role,
          plan: user.plan,
        };

    res.status(200).json({ user: payload, accessToken, refreshToken });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// -------------------- Register User -------------------- //
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role, plan } = req.body;

    if (!name || !email || !password || !role)
      return res.status(400).json({ message: "All fields required" });

    // User already exists?
    if (await User.findOne({ email }))
      return res.status(409).json({ message: "User already exists" });

    // Create new user (NO token generation)
    const user = await User.create({
      name,
      email,
      password,
      role,
      plan: plan || "basic",
    });

    // Send back only user info — NOT logged in
    res.status(201).json({
      message: "User registered successfully. Please login.",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        plan: user.plan,
      },
    });

  } catch (err) {
    console.error("Register user error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// -------------------- Register Company -------------------- //
// -------------------- Register Company -------------------- //
export const registerCompany = async (req, res) => {
  try {
    const { companyName, email, password, plan, ...rest } = req.body;

    if (!companyName || !email || !password)
      return res.status(400).json({ message: "Required fields missing" });

    // Check if company exists
    if (await Company.findOne({ email }))
      return res.status(409).json({ message: "Company already exists" });

    // Create company (NO TOKEN GENERATION)
    const company = await Company.create({
      companyName,
      email,
      password,
      plan,
      ...rest,
    });

    // Respond with newly created company details (NO COOKIES)
    res.status(201).json({
      message: "Company registered successfully. Please login.",
      company: {
        _id: company._id,
        companyName,
        email,
        plan: company.plan,
      },
    });

  } catch (err) {
    console.error("Register company error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// -------------------- Get Current User -------------------- //
export const getMe = async (req, res) => {
  try {
    if (!req.user)
      return res.status(401).json({ message: "Unauthorized" });

    const userObj = req.user.toObject ? req.user.toObject() : req.user;
    res.status(200).json({ user: { ...userObj, role: req.role } });
  } catch (err) {
    console.error("GetMe error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// -------------------- Logout (FIXED) -------------------- //
export const logout = async (req, res) => {
  try {
    const token = req.cookies.accessToken;
    if (!token)
      return res.status(400).json({ message: "No token" });

    const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const Model = payload.role === "company" ? Company : User;

    await Model.findByIdAndUpdate(
      payload.id,
      { $unset: { refreshToken: "" } },
      { new: true }
    );

    // MUST use same cookie options to clear
    res.clearCookie("accessToken", clearCookieOptions());
    res.clearCookie("refreshToken", clearCookieOptions());

    res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// -------------------- Refresh Token -------------------- //
export const refreshToken = async (req, res) => {
  try {
    const bearer = req.headers.authorization || req.headers.Authorization;
    const headerToken =
      typeof bearer === "string" && bearer.startsWith("Bearer ")
        ? bearer.slice(7)
        : null;

    const refresh =
      req.body?.refreshToken ||
      headerToken ||
      req.cookies?.refreshToken;

    if (!refresh)
      return res.status(401).json({ message: "No refresh token provided" });

    const payload = jwt.verify(refresh, process.env.REFRESH_TOKEN_SECRET);

    const Model = payload.role === "company" ? Company : User;
    const user = await Model.findById(payload.id);

    if (!user || user.refreshToken !== refresh)
      return res.status(401).json({ message: "Invalid refresh token" });

    const accessToken = jwt.sign(
      { id: user._id, role: payload.role },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN }
    );

    // Issue new tokens (no rotation here; reuse existing refresh token)
    res.cookie("accessToken", accessToken, getCookieOptions(15 * 60 * 1000));
    res.status(200).json({
      accessToken,
      refreshToken: refresh,
      message: "Access token refreshed",
    });

  } catch (err) {
    console.error("Refresh token error:", err);
    res.status(401).json({ message: "Invalid or expired refresh token" });
  }
};