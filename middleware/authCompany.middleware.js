import jwt from "jsonwebtoken";
import Company from "../models/company.js";

export const requireCompanyAuth = async (req, res, next) => {
  try {
    let token = req.cookies?.accessToken;

    // If cookie doesn't exist, check Bearer token
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer "))
        token = authHeader.split(" ")[1];
    }

    // Still no token?
    if (!token || token === "undefined" || token === "")
      return res.status(401).json({ success: false, message: "No token provided" });

    // Verify token
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const company = await Company
      .findById(decoded.id)
      .select("-password -refreshToken");

    if (!company)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    req.company = company;
    next();

  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};
