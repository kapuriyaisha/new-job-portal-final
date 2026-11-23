import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EmailIcon from "@mui/icons-material/Email";
import SendIcon from "@mui/icons-material/Send";
import axios from "axios";

const EMAIL_TEMPLATES = [
  ["interview_invitation", "Interview Invitation"],
  ["application_acceptance", "Application Acceptance"],
  ["application_rejection", "Application Rejection"],
  ["interview_rescheduling", "Interview Rescheduling"],
  ["application_follow_up", "Application Follow-up"],
  ["job_offer", "Job Offer Email"],
];

const TONES = [
  ["professional", "Professional"],
  ["friendly", "Friendly"],
  ["formal", "Formal"],
];

const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());

const getCandidateName = (application) =>
  application?.applicantName ||
  `${application?.user?.firstName || ""} ${application?.user?.lastName || ""}`.trim() ||
  "Candidate";

const getCandidateEmail = (application) =>
  application?.applicantEmail || application?.email || application?.user?.email || "";

const RecruiterEmailGenerator = () => {
  const [applications, setApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [applicationsError, setApplicationsError] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [emailType, setEmailType] = useState(EMAIL_TEMPLATES[0][0]);
  const [tone, setTone] = useState(TONES[0][0]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let active = true;

    const loadApplications = async () => {
      setApplicationsLoading(true);
      try {
        const { data } = await axios.get("/api/recruiter/applications");
        if (!Array.isArray(data?.applications)) {
          throw new Error("Recruiter applications response is invalid");
        }
        if (active) {
          setApplications(data.applications);
          setApplicationsError("");
        }
      } catch (error) {
        if (active) {
          setApplicationsError(
            error.response?.data?.error ||
              "Unable to load your received applications.",
          );
        }
      } finally {
        if (active) setApplicationsLoading(false);
      }
    };

    loadApplications();
    return () => {
      active = false;
    };
  }, []);

  const selectedApplication = useMemo(
    () => applications.find((application) => String(application._id) === applicationId),
    [applications, applicationId],
  );
  const candidateName = getCandidateName(selectedApplication);
  const candidateEmail = getCandidateEmail(selectedApplication);
  const validRecipient = isValidEmail(candidateEmail);

  const resetDraft = () => {
    setSubject("");
    setBody("");
    setDraftReady(false);
    setSent(false);
    setMessage(null);
  };

  const handleGenerate = async () => {
    if (!selectedApplication) {
      setMessage({ severity: "error", text: "Select a candidate application first." });
      return;
    }
    if (!validRecipient) {
      setMessage({
        severity: "error",
        text: "This candidate does not have a valid registered email address.",
      });
      return;
    }

    setGenerating(true);
    setMessage(null);
    resetDraft();
    try {
      const { data } = await axios.post("/api/recruiter/email-generator/generate", {
        applicationId,
        emailType,
        tone,
      });
      if (
        typeof data?.subject !== "string" ||
        typeof data?.body !== "string" ||
        !data.subject.trim() ||
        !data.body.trim()
      ) {
        throw new Error("The generated email draft is incomplete.");
      }
      setSubject(data.subject);
      setBody(data.body);
      setDraftReady(true);
      setMessage({ severity: "success", text: "Email draft generated. Review and edit it before sending." });
    } catch (error) {
      setMessage({
        severity: "error",
        text:
          error.response?.data?.error ||
          error.message ||
          "Unable to generate the email draft. Please try again.",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setMessage({ severity: "success", text: "Email copied to clipboard." });
    } catch {
      setMessage({
        severity: "error",
        text: "Unable to copy the email. Check clipboard permissions and try again.",
      });
    }
  };

  const handleSend = async () => {
    if (!validRecipient) {
      setMessage({
        severity: "error",
        text: "A valid candidate email address is required before sending.",
      });
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setMessage({ severity: "error", text: "Email subject and body cannot be empty." });
      return;
    }
    if (
      !window.confirm(
        `Send this email to ${candidateName} (${candidateEmail})?`,
      )
    ) {
      return;
    }

    setSending(true);
    setMessage(null);
    try {
      const { data } = await axios.post("/api/recruiter/email-generator/send", {
        applicationId,
        emailType,
        tone,
        subject,
        body,
      });
      setSent(true);
      setMessage({
        severity: "success",
        text:
          data?.historySaved === false
            ? `Email sent to ${candidateName}, but its history could not be saved.`
            : `Email sent to ${candidateName} at ${candidateEmail}.`,
      });
    } catch (error) {
      setMessage({
        severity: "error",
        text:
          error.response?.data?.error ||
          "Unable to send the email. Please try again.",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ color: "black", mb: 1 }}>
        Recruitment Email Generator
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Create and send a personalized email to a candidate from your received applications.
      </Typography>

      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
        {applicationsError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {applicationsError}
          </Alert>
        )}
        {applicationsLoading ? (
          <Stack alignItems="center" spacing={1} py={4}>
            <CircularProgress />
            <Typography color="text.secondary">Loading your applications…</Typography>
          </Stack>
        ) : (
          <>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel id="email-application-label">Candidate application</InputLabel>
                  <Select
                    labelId="email-application-label"
                    label="Candidate application"
                    value={applicationId}
                    onChange={(event) => {
                      setApplicationId(event.target.value);
                      resetDraft();
                    }}
                    disabled={applications.length === 0}
                  >
                    {applications.map((application) => (
                      <MenuItem key={application._id} value={String(application._id)}>
                        {getCandidateName(application)} — {application.jobTitle || application.jobId?.title || "Job"}
                        {application.jobCompany ? ` (${application.jobCompany})` : ""}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {applications.length === 0 && !applicationsError && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    You do not have any received applications yet.
                  </Alert>
                )}
              </Grid>

              {selectedApplication && (
                <Grid item xs={12}>
                  <Alert severity={validRecipient ? "info" : "warning"}>
                    <strong>{candidateName}</strong>
                    {" · "}
                    {validRecipient
                      ? candidateEmail
                      : "No valid registered email address is available."}
                    {" · "}
                    {selectedApplication.jobTitle ||
                      selectedApplication.jobId?.title ||
                      "Job title unavailable"}
                    {selectedApplication.jobCompany
                      ? ` at ${selectedApplication.jobCompany}`
                      : ""}
                  </Alert>
                </Grid>
              )}

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel id="email-type-label">Email template</InputLabel>
                  <Select
                    labelId="email-type-label"
                    label="Email template"
                    value={emailType}
                    onChange={(event) => {
                      setEmailType(event.target.value);
                      resetDraft();
                    }}
                  >
                    {EMAIL_TEMPLATES.map(([value, label]) => (
                      <MenuItem key={value} value={value}>{label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel id="email-tone-label">Tone</InputLabel>
                  <Select
                    labelId="email-tone-label"
                    label="Tone"
                    value={tone}
                    onChange={(event) => {
                      setTone(event.target.value);
                      resetDraft();
                    }}
                  >
                    {TONES.map(([value, label]) => (
                      <MenuItem key={value} value={value}>{label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Button
              variant="contained"
              startIcon={generating ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
              onClick={handleGenerate}
              disabled={applicationsLoading || !selectedApplication || !validRecipient || generating}
              sx={{ mt: 2, textTransform: "none", fontWeight: 700 }}
            >
              {generating ? "Generating…" : "Generate Email"}
            </Button>
          </>
        )}
      </Paper>

      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}

      {draftReady && (
        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <EmailIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>Editable Email Preview</Typography>
          </Stack>
          <TextField
            fullWidth
            label="Subject"
            value={subject}
            onChange={(event) => {
              setSubject(event.target.value);
              setSent(false);
            }}
            inputProps={{ maxLength: 200 }}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            multiline
            minRows={10}
            label="Email body"
            value={body}
            onChange={(event) => {
              setBody(event.target.value);
              setSent(false);
            }}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={handleCopy}
              sx={{ textTransform: "none" }}
            >
              Copy Email
            </Button>
            <Button
              variant="contained"
              startIcon={sending ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
              onClick={handleSend}
              disabled={
                sending ||
                sent ||
                !validRecipient ||
                !subject.trim() ||
                !body.trim()
              }
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              {sending ? "Sending…" : sent ? "Email Sent" : "Send Email"}
            </Button>
          </Stack>
        </Paper>
      )}
    </Box>
  );
};

export default RecruiterEmailGenerator;
