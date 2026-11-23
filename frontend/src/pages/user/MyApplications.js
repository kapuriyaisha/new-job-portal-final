import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import axios from "axios";
import { Link } from "react-router-dom";

const statusStyles = {
  Applied: { bgcolor: "#E3F2FD", color: "#1565C0" },
  Shortlisted: { bgcolor: "#FFF3E0", color: "#E65100" },
  Rejected: { bgcolor: "#FFEBEE", color: "#C62828" },
  Selected: { bgcolor: "#E8F5E9", color: "#2E7D32" },
};

const getStatusLabel = (status) => {
  switch (String(status || "pending").toLowerCase()) {
    case "pending":
    case "applied":
      return "Applied";
    case "under_review":
    case "shortlisted":
    case "interview":
      return "Shortlisted";
    case "rejected":
      return "Rejected";
    case "selected":
    case "accepted":
      return "Selected";
    default:
      return "Applied";
  }
};

const formatAppliedDate = (date) => {
  const parsedDate = date ? new Date(date) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    return "Date unavailable";
  }

  return parsedDate.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const MyApplications = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;

    const fetchApplications = async () => {
      try {
        const { data } = await axios.get("/api/applications/my");
        if (!Array.isArray(data?.applications)) {
          throw new Error("The applications response was not in the expected format.");
        }
        if (active) setApplications(data.applications);
      } catch (error) {
        if (active) {
          setLoadError(
            error.response?.data?.message ||
              error.message ||
              "Unable to load your applications. Please try again.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchApplications();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }} aria-busy={loading}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        spacing={2}
        mb={3}
      >
        <Typography variant="h4" sx={{ color: "#263238", fontWeight: 700 }}>
          My Applications
        </Typography>
        <Button
          component={Link}
          to="/jobs"
          variant="contained"
          sx={{
            bgcolor: "#2196F3",
            color: "#FFFFFF",
            textTransform: "none",
            fontWeight: 700,
            "&:hover": { bgcolor: "#1565C0" },
          }}
        >
          Browse Jobs
        </Button>
      </Stack>

      {loading ? (
        <Box
          role="status"
          sx={{
            minHeight: 240,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          <CircularProgress sx={{ color: "#2196F3" }} />
          <Typography sx={{ color: "#546E7A" }}>Loading your applications...</Typography>
        </Box>
      ) : loadError ? (
        <Alert severity="error">{loadError}</Alert>
      ) : applications.length === 0 ? (
        <Card
          sx={{
            borderRadius: 3,
            border: "1px solid #DCE8F2",
            boxShadow: "0 4px 16px rgba(38,50,56,0.06)",
          }}
        >
          <CardContent sx={{ py: 5, textAlign: "center" }}>
            <Typography variant="h6" sx={{ color: "#263238", fontWeight: 700, mb: 1 }}>
              No applications yet
            </Typography>
            <Typography sx={{ color: "#546E7A", mb: 3 }}>
              Find a role that fits and your applications will appear here.
            </Typography>
            <Button
              component={Link}
              to="/jobs"
              variant="contained"
              sx={{
                bgcolor: "#2196F3",
                color: "#FFFFFF",
                textTransform: "none",
                fontWeight: 700,
                "&:hover": { bgcolor: "#1565C0" },
              }}
            >
              Browse Jobs
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {applications.map((application) => {
            const job =
              application.jobId && typeof application.jobId === "object"
                ? application.jobId
                : {};
            const statusLabel = getStatusLabel(application.applicationStatus);
            const jobTypeName =
              typeof job.jobType === "object"
                ? job.jobType?.jobTypeName
                : "";

            return (
              <Card
                key={application._id}
                sx={{
                  borderRadius: 3,
                  border: "1px solid #DCE8F2",
                  boxShadow: "0 4px 16px rgba(38,50,56,0.06)",
                }}
              >
                <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    justifyContent="space-between"
                    spacing={2}
                  >
                    <Box>
                      <Typography variant="h6" sx={{ color: "#263238", fontWeight: 700 }}>
                        {job.title || application.title || "Job listing unavailable"}
                      </Typography>
                      <Typography sx={{ color: "#2196F3", fontWeight: 600, mt: 0.25 }}>
                        {job.companyName || "Company details unavailable"}
                      </Typography>
                    </Box>
                    <Chip
                      label={statusLabel}
                      size="small"
                      sx={{
                        ...statusStyles[statusLabel],
                        fontWeight: 700,
                      }}
                    />
                  </Stack>

                  <Stack
                    direction="row"
                    flexWrap="wrap"
                    columnGap={2}
                    rowGap={0.5}
                    mt={2}
                  >
                    <Typography variant="body2" sx={{ color: "#546E7A" }}>
                      Location: {job.location || application.location || "Not specified"}
                    </Typography>
                    {job.salary && (
                      <Typography variant="body2" sx={{ color: "#546E7A" }}>
                        Salary: {job.salary}
                      </Typography>
                    )}
                    {jobTypeName && (
                      <Typography variant="body2" sx={{ color: "#546E7A" }}>
                        Job type: {jobTypeName}
                      </Typography>
                    )}
                  </Stack>

                  <Typography variant="body2" sx={{ color: "#546E7A", mt: 1.5 }}>
                    Applied {formatAppliedDate(application.createdAt)}
                  </Typography>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}
    </Box>
  );
};

export default MyApplications;
