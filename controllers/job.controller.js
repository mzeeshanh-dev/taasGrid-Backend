import mongoose from "mongoose";
import Job from "../models/job.js";

/* ============================================================
   CREATE JOB  (Enhanced validation, safer ObjectId handling)
   ============================================================ */
export const createJob = async (req, res) => {
  try {
    const {
      title,
      description,
      experience,
      qualification,
      location,
      salary,
      jobType,
      requirements,
      workType,
      status,          // new (Active/Draft/Inactive)
      scheduleDate,    // new
      closingDate,     // new
      postedBy,
    } = req.body;

    // Required fields
    if (!postedBy)
      return res.status(400).json({ success: false, message: "postedBy is required" });

    if (!mongoose.Types.ObjectId.isValid(postedBy))
      return res.status(400).json({
        success: false,
        message: "Invalid postedBy ObjectId",
      });

    // Create job
    const job = new Job({
      title,
      description,
      experience,
      qualification,
      location,
      salary,
      jobType,
      requirements,
      workType,
      status: status || "Active",
      scheduleDate: scheduleDate || null,
      closingDate,
      postedBy,
    });

    await job.save();

    res.status(201).json({
      success: true,
      message: "Job created successfully",
      job,
    });
  } catch (error) {
    console.error("❌ createJob:", error);
    res.status(500).json({
      success: false,
      message: "Error creating job",
      error: error.message,
    });
  }
};


/* ============================================================
   GET ALL JOBS (Enhanced populate, sorting, still compatible)
   ============================================================ */
export const getJobs = async (req, res) => {
  try {
    const jobs = await Job.find()
      .populate({
        path: "postedBy",
        select: "companyName email logo address",
        strictPopulate: false,
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      jobs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching jobs",
      error: error.message,
    });
  }
};


/* ============================================================
   DELETE JOB BY ID (No behavior change)
   ============================================================ */
export const deleteJob = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job ID",
      });
    }

    const deleted = await Job.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Job deleted",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting job",
      error: error.message,
    });
  }
};


/* ============================================================
   UPDATE JOB STATUS (Enhanced validation)
   ============================================================ */
export const updateJobStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["Active", "Draft", "Inactive", "Closed"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Allowed: Active, Draft,Close, Inactive.",
      });
    }

    const job = await Job.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    res.status(200).json({
      success: true,
      job,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating job status",
      error: error.message,
    });
  }
};
/* ============================================================
   GET INTERNSHIPS (Enhanced — now includes company populate)
   ============================================================ */
export const getInternships = async (req, res) => {
  try {
    const internships = await Job.find({ jobType: "Internship" })
      .populate({
        path: "postedBy",
        select: "companyName email logo address",
        strictPopulate: false,
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: internships.length,
      internships,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch internships",
      error: error.message,
    });
  }
};

