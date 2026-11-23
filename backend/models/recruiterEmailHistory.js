const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema;

const recruiterEmailHistorySchema = new mongoose.Schema(
  {
    candidateId: { type: ObjectId, ref: "User", required: true, index: true },
    recruiterId: { type: ObjectId, ref: "User", required: true, index: true },
    jobId: { type: ObjectId, ref: "Job", required: true, index: true },
    applicationId: {
      type: ObjectId,
      ref: "UserHistory",
      required: true,
      index: true,
    },
    emailType: {
      type: String,
      enum: [
        "interview_invitation",
        "application_acceptance",
        "application_rejection",
        "interview_rescheduling",
        "application_follow_up",
        "job_offer",
      ],
      required: true,
    },
    tone: {
      type: String,
      enum: ["professional", "friendly", "formal"],
      required: true,
    },
    recipientEmail: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 12000 },
    sentAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

recruiterEmailHistorySchema.index({ recruiterId: 1, sentAt: -1 });

module.exports = mongoose.model(
  "RecruiterEmailHistory",
  recruiterEmailHistorySchema,
);
