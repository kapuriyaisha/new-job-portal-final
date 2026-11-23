import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

const getLocalDateValue = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const formatInterviewDate = (value) =>
  value
    ? new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Not scheduled";

const formatInterviewTime = (value) => {
  if (!value) return "Not scheduled";
  const [hour, minute] = value.split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
};

const getCandidateName = (application) =>
  application.applicantName ||
  `${application.user?.firstName || ""} ${application.user?.lastName || ""}`.trim() ||
  "Unknown candidate";

const getJobTitle = (application) =>
  application.jobTitle || application.jobId?.title || "Position not available";

const Interviews = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [interviewForm, setInterviewForm] = useState({
    date: "",
    time: "",
    mode: "online",
    meetingLink: "",
  });
  const [savingInterview, setSavingInterview] = useState(false);
  const [completingId, setCompletingId] = useState("");

  const loadApplications = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get("/api/recruiter/applications", {
        withCredentials: true,
      });
      setApplications(
        Array.isArray(data?.applications) ? data.applications : [],
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          requestError.response?.data?.message ||
          "Unable to load recruiter interviews.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const shortlistedApplications = applications.filter(
    (application) =>
      application.applicationStatus === "shortlisted" && !application.interview,
  );
  const scheduledApplications = applications.filter(
    (application) => Boolean(application.interview?.date),
  );

  const openInterviewForm = (application) => {
    const interview = application.interview || {};
    setSelectedApplication(application);
    setInterviewForm({
      date: interview.date || "",
      time: interview.time || "",
      mode: interview.mode || "online",
      meetingLink: interview.meetingLink || "",
    });
  };

  const closeInterviewForm = () => {
    if (!savingInterview) setSelectedApplication(null);
  };

  const saveInterview = async (event) => {
    event.preventDefault();
    if (!selectedApplication) return;

    setSavingInterview(true);
    const isReschedule = Boolean(selectedApplication.interview);
    try {
      await axios.request({
        method: isReschedule ? "patch" : "post",
        url: `/api/recruiter/applications/${selectedApplication._id}/interview`,
        data: interviewForm,
        withCredentials: true,
      });
      setSelectedApplication(null);
      toast.success(isReschedule ? "Interview updated." : "Interview scheduled.");
      await loadApplications();
    } catch (requestError) {
      toast.error(
        requestError.response?.data?.error ||
          requestError.response?.data?.message ||
          "Unable to save interview details.",
      );
    } finally {
      setSavingInterview(false);
    }
  };

  const completeInterview = async (applicationId) => {
    setCompletingId(applicationId);
    try {
      await axios.patch(
        `/api/recruiter/applications/${applicationId}/interview/complete`,
        {},
        { withCredentials: true },
      );
      toast.success("Interview marked as completed.");
      await loadApplications();
    } catch (requestError) {
      toast.error(
        requestError.response?.data?.error ||
          requestError.response?.data?.message ||
          "Unable to complete interview.",
      );
    } finally {
      setCompletingId("");
    }
  };

  const renderCandidateCard = (application, scheduled = false) => {
    const interview = application.interview;
    const response =
      typeof interview?.response === "string"
        ? interview.response
        : interview?.response?.status || "pending";
    const isCompleted = interview?.status === "completed";
    const canComplete =
      !isCompleted && ["pending", "accepted"].includes(response);

    return (
      <Grid item xs={12} md={6} key={application._id}>
        <Card sx={{ height: "100%" }}>
          <CardContent>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="flex-start"
              spacing={2}
            >
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {getCandidateName(application)}
                </Typography>
                <Typography color="text.secondary">
                  {getJobTitle(application)}
                  {application.jobCompany ? ` · ${application.jobCompany}` : ""}
                </Typography>
              </Box>
              <Chip
                size="small"
                color={isCompleted ? "success" : scheduled ? "primary" : "default"}
                label={isCompleted ? "Completed" : scheduled ? "Scheduled" : "Shortlisted"}
              />
            </Stack>

            {scheduled ? (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2">
                  Date: {formatInterviewDate(interview.date)}
                </Typography>
                <Typography variant="body2">
                  Time: {formatInterviewTime(interview.time)}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Mode: {interview.mode === "online" ? "Online" : interview.mode}
                  {" · "}Candidate response: {response}
                </Typography>
                {interview.meetingLink && (
                  <Link
                    href={interview.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    underline="hover"
                    sx={{ overflowWrap: "anywhere" }}
                  >
                    {interview.meetingLink}
                  </Link>
                )}
              </Box>
            ) : (
              <Typography sx={{ mt: 2 }} color="text.secondary">
                {application.applicantEmail || application.email || "No email available"}
              </Typography>
            )}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2 }}>
              {scheduled ? (
                <>
                  <Button
                    variant="outlined"
                    onClick={() => openInterviewForm(application)}
                  >
                    Reschedule
                  </Button>
                  {canComplete && (
                    <Button
                      variant="contained"
                      color="success"
                      disabled={completingId === application._id}
                      onClick={() => completeInterview(application._id)}
                    >
                      {completingId === application._id ? (
                        <CircularProgress size={20} />
                      ) : (
                        "Mark Completed"
                      )}
                    </Button>
                  )}
                </>
              ) : (
                <Button
                  variant="contained"
                  onClick={() => openInterviewForm(application)}
                >
                  Schedule Interview
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ color: "black", mb: 1 }}>
        Interviews
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Schedule interviews for shortlisted candidates and manage upcoming sessions.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Typography variant="h5" sx={{ mb: 2 }}>
        Shortlisted Candidates
      </Typography>
      {shortlistedApplications.length ? (
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {shortlistedApplications.map((application) =>
            renderCandidateCard(application),
          )}
        </Grid>
      ) : (
        <Alert severity="info" sx={{ mb: 4 }}>
          There are no shortlisted candidates waiting for an interview.
        </Alert>
      )}

      <Typography variant="h5" sx={{ mb: 2 }}>
        Scheduled Interviews
      </Typography>
      {scheduledApplications.length ? (
        <Grid container spacing={2}>
          {scheduledApplications.map((application) =>
            renderCandidateCard(application, true),
          )}
        </Grid>
      ) : (
        <Alert severity="info">No interviews have been scheduled yet.</Alert>
      )}

      <Dialog
        open={Boolean(selectedApplication)}
        onClose={closeInterviewForm}
        fullWidth
        maxWidth="sm"
      >
        <Box component="form" onSubmit={saveInterview}>
          <DialogTitle>
            {selectedApplication?.interview
              ? "Reschedule Interview"
              : "Schedule Interview"}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                label="Interview Date"
                type="date"
                value={interviewForm.date}
                onChange={(event) =>
                  setInterviewForm((current) => ({
                    ...current,
                    date: event.target.value,
                  }))
                }
                inputProps={{ min: getLocalDateValue() }}
                InputLabelProps={{ shrink: true }}
                required
                fullWidth
              />
              <TextField
                label="Interview Time"
                type="time"
                value={interviewForm.time}
                onChange={(event) =>
                  setInterviewForm((current) => ({
                    ...current,
                    time: event.target.value,
                  }))
                }
                InputLabelProps={{ shrink: true }}
                required
                fullWidth
              />
              <FormControl required fullWidth>
                <InputLabel id="interview-mode-label">Interview Mode</InputLabel>
                <Select
                  labelId="interview-mode-label"
                  label="Interview Mode"
                  value={interviewForm.mode}
                  onChange={(event) =>
                    setInterviewForm((current) => ({
                      ...current,
                      mode: event.target.value,
                    }))
                  }
                >
                  <MenuItem value="online">Online</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Meeting Link"
                type="url"
                value={interviewForm.meetingLink}
                onChange={(event) =>
                  setInterviewForm((current) => ({
                    ...current,
                    meetingLink: event.target.value,
                  }))
                }
                required
                fullWidth
                helperText="Enter a valid online meeting URL."
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeInterviewForm} disabled={savingInterview}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={savingInterview}>
              {savingInterview ? <CircularProgress size={20} /> : "Save Interview"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
};

export default Interviews;
