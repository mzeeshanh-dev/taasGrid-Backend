import mongoose from "mongoose";

const FypSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      validate: {
        validator: function (value) {
          // Count words by splitting the string on spaces
          const wordCount = value.trim().split(/\s+/).length;
          return wordCount <= 500; // Restrict to 500 words max
        },
        message: "Description cannot exceed 500 words.",
      },
    },

    domain: {
      type: String,
      required: true,
    },

    duration: {
      type: String,
      enum: ["3 Months", "6 Months", "1 Year"], // only these three values allowed
      required: true,
    },

    collaborationMode: {
      type: String,
      enum: ["On-site", "Remote", "Hybrid"],
      required: true,
    },

    requirements: {
      type: String,
    },

    location: {
      type: String,
    },

    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "postedByModel",
      required: true,
    },

    postedByModel: {
      type: String,
      required: true,
      enum: ["Company"], // Only company can post FYP
    },
  },
  { timestamps: true }
);

const Fyp = mongoose.model("Fyp", FypSchema);
export default Fyp;
