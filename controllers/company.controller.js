// controllers/company.controller.js
import mongoose from "mongoose";
import Company from "../models/company.js";
import Job from "../models/job.js";
import Fyp from "../models/fyp.js";
import Batch from "../models/batch.js";
import Applicant from "../models/applicant.js";

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
    const companyId = req.company._id;

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

    // ==============================
    // 4) TOTAL CVs (NEW)
    // ==============================

    // Get all job IDs of this company
    const companyJobs = await Job.find({ postedBy: companyId }).select("_id").lean();
    const jobIds = companyJobs.map(j => j._id);

    // Portal CVs (source = Portal)
    const portalCVs = await Applicant.countDocuments({
      jobId: { $in: jobIds },
      isDeleted: false,
      source: "Portal"
    });

    // Bulk CVs (source = Bulk)
    const bulkCVsAgg = await Batch.aggregate([
      { $match: { jobId: { $in: jobIds }, isDeleted: false } },
      { $project: { resumesCount: { $size: "$resumes" } } },
      { $group: { _id: null, total: { $sum: "$resumesCount" } } }
    ]);

    const bulkCVs = bulkCVsAgg[0]?.total || 0;

    const totalCVs = portalCVs + bulkCVs;

    // ==============================
    // 5) JOB STATUS COUNTS (NEW)
    // ==============================
    const statusCounts = await Job.aggregate([
      { $match: { postedBy: new mongoose.Types.ObjectId(companyId) } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $project: { _id: 0, status: "$_id", count: 1 } }
    ]);

    const statusObj = {
      Active: 0,
      Inactive: 0,
      Draft: 0,
      Closed: 0
    };

    statusCounts.forEach(s => {
      statusObj[s.status] = s.count;
    });

    // Console log counts
    console.log("Job Status Counts:", statusObj);

    // ==============================
    // END JOB STATUS COUNTS
    // ==============================

    res.status(200).json({
      success: true,
      data: {
        totals: {
          jobs: jobsCount,
          internships: internshipsCount,
          fyps: fypsCount,
          cvs: {
            total: totalCVs,
            portal: portalCVs,
            bulk: bulkCVs
          }
        },
        jobTypeStats,
        jobStatusCounts: statusObj
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

