import mongoose from "mongoose";

const JobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Job title is required"],
      trim: true,
    },

    description: {
      type: String,
      required: [true, "Job description is required"],
      maxlength: 5000, // ~500 words
      trim: true,
    },

    experience: {
      type: String,
      enum: ["Fresher", "1-2 years", "3-4 years", "5-6 years", "6+ years"],
      required: true,
    },

    qualification: {
      type: String,
      enum: [
        "High School",
        "Diploma",
        "Bachelor's",
        "Master's",
        "Doctorate",
      ],
      required: true,
    },

    location: {
      type: String,
      required: true,
      trim: true,
    },

    salary: {
      type: String,
      enum: [
      "$100-$300",
      "$300-$500",
      "$500-$800",
      "$800-$1000",
      "$1000-$1500",
      "$1500-$2000",
      "$2000-$2500",
      "$2500-$3000",
      "$3000+"
    ],
      required: true,
    },

    jobType: {
      type: String,
      enum: ["Full-time", "Part-time", "Contract", "Internship", "Other"],
      required: true,
    },

    workType: {
      type: String,
      enum: ["On-Site", "Hybrid", "Remote"],
      required: true,
    },

    // ⭐ Requirements
    requirements: {
      type: [String],
      required: true,
    },

    // ⭐ NEW STATUS SETUP
    status: {
      type: String,
      enum: ["Active", "Draft", "Inactive", "Closed"],
      default: "Active",
    },

    // ⭐ Job goes active on this date
    scheduleDate: {
      type: Date,
      default: null,
    },

    // ⭐ After this date, job closes automatically
    closingDate: {
      type: Date,
      required: [true, "Closing date is required"],
    },

    // ⭐ Company reference
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Job", JobSchema);
