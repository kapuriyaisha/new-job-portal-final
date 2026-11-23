const Job = require("../models/jobModel");
const User = require("../models/userModel");
const UserHistory = require("../models/jobHistory");
const RecruiterEmailHistory = require("../models/recruiterEmailHistory");
const ErrorResponse = require("../utils/errorResponse");
const sendEmail = require("../utils/email");
const { generateRecruitmentEmail } = require("../services/resumeAnalyzerService");

const EMAIL_TYPES = {
  interview_invitation: "Interview Invitation",
  application_acceptance: "Application Acceptance",
  application_rejection: "Application Rejection",
  interview_rescheduling: "Interview Rescheduling",
  application_follow_up: "Application Follow-up",
  job_offer: "Job Offer Email",
};
const TONES = new Set(["professional", "friendly", "formal"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getApplicationContext = async (applicationId, recruiterId) => {
  if (!applicationId) {
    throw new ErrorResponse("Select a candidate application", 400);
  }

  const application = await UserHistory.findById(applicationId).lean();
  if (!application) {
    throw new ErrorResponse("Application not found", 404);
  }

  const job = await Job.findOne({
    _id: application.jobId,
    user: recruiterId,
    isDeleted: false,
  })
    .select("_id title companyName")
    .lean();
  if (!job) {
    throw new ErrorResponse("Application not found", 404);
  }

  const candidate = await User.findById(application.user)
    .select("_id firstName lastName email")
    .lean();
  if (!candidate) {
    throw new ErrorResponse("Candidate not found", 404);
  }

  const candidateName =
    `${candidate.firstName || ""} ${candidate.lastName || ""}`.trim();
  if (!candidateName) {
    throw new ErrorResponse("Candidate name is unavailable", 400);
  }
  if (!EMAIL_PATTERN.test(candidate.email || "")) {
    throw new ErrorResponse("Candidate has no valid registered email address", 400);
  }

  return { application, candidate, candidateName, job };
};

const validateEmailOptions = (emailType, tone) => {
  if (!Object.prototype.hasOwnProperty.call(EMAIL_TYPES, emailType)) {
    throw new ErrorResponse("Choose a valid email template", 400);
  }
  if (!TONES.has(tone)) {
    throw new ErrorResponse("Choose a valid email tone", 400);
  }
};

exports.generateRecruitmentEmail = async (req, res, next) => {
  try {
    const { applicationId, emailType, tone } = req.body || {};
    validateEmailOptions(emailType, tone);
    const { candidateName, job } = await getApplicationContext(
      applicationId,
      req.user._id,
    );
    const draft = await generateRecruitmentEmail({
      candidateName,
      jobTitle: job.title,
      companyName: job.companyName,
      emailType: EMAIL_TYPES[emailType],
      tone,
    });

    return res.status(200).json({ success: true, ...draft });
  } catch (error) {
    return next(error);
  }
};

exports.sendRecruitmentEmail = async (req, res, next) => {
  try {
    const { applicationId, emailType, tone, subject, body } = req.body || {};
    validateEmailOptions(emailType, tone);
    if (
      typeof subject !== "string" ||
      !subject.trim() ||
      subject.trim().length > 200 ||
      typeof body !== "string" ||
      !body.trim() ||
      body.trim().length > 12000
    ) {
      throw new ErrorResponse("Enter a valid email subject and body", 400);
    }

    const { application, candidate, job } = await getApplicationContext(
      applicationId,
      req.user._id,
    );
    const cleanSubject = subject.trim();
    const cleanBody = body.trim();

    try {
      await sendEmail({
        email: candidate.email,
        subject: cleanSubject,
        text: cleanBody,
      });
    } catch (error) {
      console.error("[recruiter-email] Delivery failed", {
        applicationId: String(application._id),
        recruiterId: String(req.user._id),
        category: error.category || "EMAIL_ERROR",
        code: error.code,
      });
      throw new ErrorResponse("Unable to send email. Please try again.", 502);
    }

    const sentAt = new Date();
    let historySaved = true;
    try {
      await RecruiterEmailHistory.create({
        candidateId: candidate._id,
        recruiterId: req.user._id,
        jobId: job._id,
        applicationId: application._id,
        emailType,
        tone,
        recipientEmail: candidate.email,
        subject: cleanSubject,
        body: cleanBody,
        sentAt,
      });
    } catch (error) {
      historySaved = false;
      console.error("[recruiter-email] Delivery succeeded but history could not be saved", {
        applicationId: String(application._id),
        recruiterId: String(req.user._id),
        code: error.code || error.name,
      });
    }

    return res.status(200).json({
      success: true,
      historySaved,
      sentAt,
      recipientEmail: candidate.email,
    });
  } catch (error) {
    return next(error);
  }
};
