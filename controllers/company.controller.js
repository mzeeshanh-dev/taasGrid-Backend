// controllers/company.controller.js
import mongoose from "mongoose";
import Company from "../models/company.js";
import Job from "../models/job.js";
import Fyp from "../models/fyp.js";

// GET single company by ID (public)
export const getCompanyById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ success: false, message: "Invalid company id" });

    const company = await Company.findById(id).select("-password -refreshTokenHash");
    if (!company) return res.status(404).json({ success: false, message: "Company not found" });

    res.status(200).json({ success: true, company });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// UPDATE company (protected, only owner)
export const updateCompanyById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ success: false, message: "Invalid company id" });

    // Only allow owner
    if (req.company._id.toString() !== id)
      return res.status(403).json({ success: false, message: "Forbidden" });

    const allowedFields = [
      "companyName", "email", "phone", "address", "website",
      "description", "industry", "size", "plan", "establishedYear", "logo"
    ];

    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const updatedCompany = await Company.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    }).select("-password -refreshTokenHash");

    if (!updatedCompany)
      return res.status(404).json({ success: false, message: "Company not found" });

    res.status(200).json({ success: true, message: "Company updated", company: updatedCompany });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DASHBOARD: aggregated job & fyp counts (protected)
export const getCompanyDashboardData = async (req, res) => {
  try {
    const companyId = req.company._id; // ✅ secure: from token

    // 1) jobType stats
    const jobTypeStats = await Job.aggregate([
      { $match: { postedBy: new mongoose.Types.ObjectId(companyId) } },
      { $group: { _id: "$jobType", count: { $sum: 1 } } },
      { $project: { _id: 0, jobType: "$_id", count: 1 } },
      { $sort: { count: -1 } }
    ]);

    // 2) totals: jobs vs internships
    const totals = await Job.aggregate([
      { $match: { postedBy: new mongoose.Types.ObjectId(companyId) } },
      { $group: { _id: { isInternship: { $eq: ["$jobType", "Internship"] } }, count: { $sum: 1 } } }
    ]);

    let jobsCount = 0, internshipsCount = 0;
    totals.forEach(t => {
      if (t._id && t._id.isInternship) internshipsCount = t.count;
      else jobsCount = t.count;
    });

    // 3) FYP count
    const fypsCount = await Fyp.countDocuments({ postedBy: companyId });

    res.status(200).json({
      success: true,
      data: {
        totals: { jobs: jobsCount, internships: internshipsCount, fyps: fypsCount },
        jobTypeStats
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
