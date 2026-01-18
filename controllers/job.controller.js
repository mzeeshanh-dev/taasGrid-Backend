import mongoose from "mongoose";
import Job from "../models/job.js";

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
      status,       // Active/Draft/Inactive
      scheduleDate,
      closingDate,
    } = req.body;


    const company = req.company;
    if (!company)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    // Required fields validation
    if (!title || !description || !experience || !qualification || !location || !salary || !jobType || !requirements || !workType || !closingDate) {
      return res.status(400).json({ success: false, message: "Missing required job fields" });
    }

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
      postedBy: company._id,
      companyId: company.companyId,
    });

    await job.save();

    res.status(201).json({
      success: true,
      message: "Job created successfully",
      job,
    });
  } catch (error) {
    console.error("createJob:", error);
    res.status(500).json({
      success: false,
      message: "Error creating job",
      error: error.message,
    });
  }
};

export const getJobs = async (req, res) => {
  try {
    const jobs = await Job.find()
      .populate({
        path: "postedBy",
        select: "companyName email logo address companyId",
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

export const deleteJob = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ success: false, message: "Invalid job ID" });

    const deleted = await Job.findByIdAndDelete(id);

    if (!deleted)
      return res.status(404).json({ success: false, message: "Job not found" });

    res.status(200).json({ success: true, message: "Job deleted" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting job",
      error: error.message,
    });
  }
};

export const updateJobStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["Active", "Draft", "Inactive", "Closed"];
    if (!allowedStatuses.includes(status))
      return res.status(400).json({
        success: false,
        message: "Invalid status. Allowed: Active, Draft, Inactive, Closed",
      });

    const job = await Job.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    if (!job)
      return res.status(404).json({ success: false, message: "Job not found" });

    res.status(200).json({ success: true, job });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating job status",
      error: error.message,
    });
  }
};

export const getInternships = async (req, res) => {
  try {
    const internships = await Job.find({ jobType: "Internship" })
      .populate({
        path: "postedBy",
        select: "companyName email logo address companyId",
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


export const getJobCriteria = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: "jobId is required",
      });
    }

    // Accept both MongoDB _id and custom jobId
    const query = mongoose.Types.ObjectId.isValid(jobId)
      ? { $or: [{ _id: jobId }, { jobId: jobId }] }
      : { jobId: jobId };

    const job = await Job.findOne(query);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    const criteria = {
      requirements: job.requirements || [],
      experience: job.experience,
      qualification: job.qualification,
      location: job.location,
      jobType: job.jobType,
      workType: job.workType,
    };

    return res.status(200).json({
      success: true,
      criteria,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch criteria",
      error: error.message,
    });
  }
};
