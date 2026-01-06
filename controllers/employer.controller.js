// import Employer from "@/models/employer.js";
import Employer from "../models/employer.js";

// Register new employer
export const registerEmployer = async (req, res) => {
  try {
    const { fullName, email, password, companyName, position, phone } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: "Full name, email, and password are required" });
    }

    const existingEmployer = await Employer.findOne({ email });
    if (existingEmployer) {
      return res.status(400).json({ error: "Email already in use" });
    }

    const employer = await Employer.create({
      fullName,
      email,
      password,
      companyName,
      position,
      phone,
    });

    const accessToken = employer.generateAccessToken();
    const refreshToken = employer.generateRefreshToken();

    employer.refreshToken = refreshToken;
    await employer.save();

    res.status(201).json({
      message: "Employer registered successfully",
      employer: {
        _id: employer._id,
        fullName: employer.fullName,
        email: employer.email,
        companyName: employer.companyName,
        role: "employer",
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Error registering employer:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Employer login
export const loginEmployer = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const employer = await Employer.findOne({ email });
    if (!employer) return res.status(401).json({ error: "Invalid credentials" });

    const isPasswordValid = await employer.isPasswordCorrect(password);
    if (!isPasswordValid) return res.status(401).json({ error: "Invalid credentials" });

    const accessToken = employer.generateAccessToken();
    const refreshToken = employer.generateRefreshToken();

    employer.refreshToken = refreshToken;
    await employer.save();

    res.status(200).json({
      message: "Login successful",
      employer: {
        _id: employer._id,
        fullName: employer.fullName,
        email: employer.email,
        companyName: employer.companyName,
        role: "employer",
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Error logging in employer:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Logout employer
export const logoutEmployer = async (req, res) => {
  try {
    const { employerId } = req.body;
    const employer = await Employer.findById(employerId);
    if (!employer) return res.status(404).json({ error: "Employer not found" });

    employer.refreshToken = "";
    await employer.save();

    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Error logging out employer:", error);
    res.status(500).json({ error: "Server error" });
  }
};
