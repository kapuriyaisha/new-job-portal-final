const mongoose = require("mongoose");

const userPlatformFeedbackSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    role: { type: String, enum: ["User"] },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    feedback: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "reviewed", "resolved"],
      default: "pending",
    },
    adminNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    reviewedAt: { type: Date },
  },
  { timestamps: false },
);

userPlatformFeedbackSchema.index({ user: 1, submittedAt: -1 });

module.exports = mongoose.model("UserPlatformFeedback", userPlatformFeedbackSchema);