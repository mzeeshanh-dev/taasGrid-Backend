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
      status,
      scheduleDate,
      closingDate,
    } = req.body;

    const company = req.company || { _id: req.body.postedBy || null };


    // Required fields
    if (
      !title ||
      !description ||
      !experience ||
      !qualification ||
      !location ||
      !salary ||
      !jobType ||
      !workType ||
      !requirements ||
      !closingDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required job fields",
      });
    }

    // Date validation
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const closing = new Date(closingDate);
    if (closing <= today) {
      return res.status(400).json({
        success: false,
        message: "Closing date must be after today",
      });
    }

    if (status === "Scheduled") {
      if (!scheduleDate) {
        return res.status(400).json({
          success: false,
          message: "Schedule date is required for scheduled jobs",
        });
      }

      const schedule = new Date(scheduleDate);

      if (schedule <= today) {
        return res.status(400).json({
          success: false,
          message: "Schedule date must be after today",
        });
      }

      if (schedule >= closing) {
        return res.status(400).json({
          success: false,
          message: "Schedule date must be before closing date",
        });
      }
    }

    const job = new Job({
      title,
      description,
      experience,
      qualification,
      location,
      salary,
      jobType,
      workType,
      requirements,
      status: status || "Active",
      scheduleDate: status === "Scheduled" ? scheduleDate : null,
      closingDate,
      postedBy: company._id || null,
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
      ? { $or: [{ _id: jobId }, { jobId }] }
      : { jobId };

    const job = await Job.findOne(query)
      .populate("postedBy", "companyName companyId"); // 👈 IMPORTANT LINE

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    const criteria = {
      companyName: job.postedBy?.companyName || "N/A",
      companyId: job.postedBy?.companyId || null,
      description: job.description,
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



export const getJobById = async (req, res) => {
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

    const job = await Job.findOne(query).populate({
      path: "postedBy",
      select: "companyName email logo address companyId",
      strictPopulate: false,
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    return res.status(200).json({
      success: true,
      job,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch job",
      error: error.message,
    });
  }
};



export const updateJob = async (req, res) => {
  try {
    const { id } = req.params;
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
      status,
      scheduleDate,
      closingDate,
    } = req.body;

    const job = await Job.findById(id);
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });

    // Don't allow editing if closingDate is past
    const today = new Date();
    if (new Date(job.closingDate) < today) {
      return res.status(400).json({ success: false, message: "Cannot edit expired job" });
    }

    // Update fields
    job.title = title || job.title;
    job.description = description || job.description;
    job.experience = experience || job.experience;
    job.qualification = qualification || job.qualification;
    job.location = location || job.location;
    job.salary = salary || job.salary;
    job.jobType = jobType || job.jobType;
    job.workType = workType || job.workType;
    job.requirements = Array.isArray(requirements) ? requirements : job.requirements;
    job.status = status || job.status;
    job.scheduleDate = scheduleDate || job.scheduleDate;
    job.closingDate = closingDate || job.closingDate;

    await job.save();

    res.status(200).json({ success: true, job });
  } catch (error) {
    console.error("updateJob:", error);
    res.status(500).json({ success: false, message: "Error updating job", error: error.message });
  }
};


export const getJobsByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid companyId",
      });
    }

    const jobs = await Job.find({
      postedBy: companyId,
      isDeleted: false,
    })
      .populate({
        path: "postedBy",
        select: "companyName email logo address companyId",
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: jobs.length,
      jobs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching company jobs",
      error: error.message,
    });
  }
};
