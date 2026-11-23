"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { afterEach, test } = require("node:test");

const backendPath = path.resolve(__dirname, "..");
const modulePaths = {
  controller: path.join(
    backendPath,
    "controllers",
    "recruiterInterviewController.js",
  ),
  errorResponse: path.join(backendPath, "utils", "errorResponse.js"),
  job: path.join(backendPath, "models", "jobModel.js"),
  user: path.join(backendPath, "models", "userModel.js"),
  history: path.join(backendPath, "models", "jobHistory.js"),
  notification: path.join(backendPath, "models", "notificationModel.js"),
  email: path.join(backendPath, "utils", "email.js"),
  jobsController: path.join(backendPath, "controllers", "jobsController.js"),
};

let originalModules = new Map();
let activeMocks;

const mockModule = (filePath, exports) => {
  originalModules.set(filePath, require.cache[filePath]);
  require.cache[filePath] = {
    id: filePath,
    filename: filePath,
    loaded: true,
    exports,
  };
};

const createInterviewFlow = ({
  candidateEmail = "candidate.registered@example.com",
  emailError,
  hasInterview = false,
} = {}) => {
  const calls = { emails: [], logs: [], order: [], saves: [] };
  const candidate = {
    email: candidateEmail,
    firstName: "Candidate",
    lastName: "Person",
  };
  const application = {
    _id: "application-123",
    user: "candidate-user-456",
    jobId: "job-789",
    applicationStatus: hasInterview ? "interview" : "shortlisted",
    statusHistory: [],
    ...(hasInterview
      ? {
          interview: {
            date: "2099-12-01",
            time: "09:00",
            mode: "online",
            meetingLink: "https://meet.example.com/old-room",
            recruiter: "recruiter-321",
            response: "pending",
          },
        }
      : {}),
  };
  const job = {
    _id: "job-789",
    user: "recruiter-321",
    title: "Software Engineer",
    companyName: "Example Company",
  };

  class ErrorResponse extends Error {
    constructor(message, codeStatus) {
      super(message);
      this.codeStatus = codeStatus;
    }
  }

  const User = {
    findById(userId) {
      assert.equal(userId, application.user);
      return {
        select: async (fields) => {
          assert.ok(
            ["firstName lastName", "email firstName lastName"].includes(fields),
          );
          return candidate;
        },
      };
    },
    findByIdAndUpdate: async () => candidate,
  };
  const UserHistory = {
    findById: async () => application,
    findOneAndUpdate: async (_filter, update) => {
      calls.order.push("saved");
      calls.saves.push({ ...update.$set });
      Object.assign(application, update.$set);
      return application;
    },
  };

  mockModule(modulePaths.errorResponse, ErrorResponse);
  mockModule(modulePaths.job, { findById: async () => job });
  mockModule(modulePaths.user, User);
  mockModule(modulePaths.history, UserHistory);
  mockModule(modulePaths.notification, {
    findOneAndUpdate: async (_filter, update) => update.$set,
  });
  mockModule(modulePaths.email, async (message) => {
    calls.order.push("email");
    calls.emails.push(message);
    if (emailError) throw emailError;
    return { accepted: [message.email] };
  });
  mockModule(modulePaths.jobsController, {
    normalizeApplicationStatus: (status) =>
      String(status || "pending").toLowerCase(),
    addStatusHistoryEntry: async (record) => {
      record.statusHistory.push({
        rawStatus: "interview",
        status: "Interview",
      });
      return true;
    },
  });

  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  console.error = (...args) => calls.logs.push(["error", ...args]);
  console.warn = (...args) => calls.logs.push(["warn", ...args]);
  originalModules.set(
    modulePaths.controller,
    require.cache[modulePaths.controller],
  );
  delete require.cache[modulePaths.controller];
  const controller = require(modulePaths.controller);

  activeMocks = {
    application,
    calls,
    controller,
    job,
    originalConsoleError,
    originalConsoleWarn,
  };
  return activeMocks;
};

const invoke = async (flow, handler, body) => {
  let responseStatus;
  let responseBody;
  let nextError;
  const response = {
    status(code) {
      responseStatus = code;
      return this;
    },
    json(payload) {
      responseBody = payload;
      return this;
    },
  };

  await handler(
    {
      body,
      params: { applicationId: flow.application._id },
      user: { _id: "recruiter-321" },
    },
    response,
    (error) => {
      nextError = error;
    },
  );
  return { responseBody, responseStatus, nextError };
};

const interviewDetails = {
  date: "2099-12-01",
  time: "10:30",
  mode: "online",
  meetingLink: "https://meet.example.com/new-room",
};

afterEach(() => {
  if (activeMocks) {
    console.error = activeMocks.originalConsoleError;
    console.warn = activeMocks.originalConsoleWarn;
  }
  for (const [filePath, originalModule] of originalModules) {
    delete require.cache[filePath];
    if (originalModule) require.cache[filePath] = originalModule;
  }
  originalModules = new Map();
  activeMocks = undefined;
});

test("sends the scheduled interview details to the candidate's registered email", async () => {
  const flow = createInterviewFlow();
  const result = await invoke(
    flow,
    flow.controller.scheduleRecruiterInterview,
    interviewDetails,
  );

  assert.equal(result.responseStatus, 201);
  assert.equal(result.nextError, undefined);
  assert.equal(flow.application.interview.date, interviewDetails.date);
  assert.equal(flow.calls.emails.length, 1);
  assert.deepEqual(flow.calls.order, ["saved", "email"]);
  assert.equal(
    flow.calls.emails[0].email,
    "candidate.registered@example.com",
  );
  assert.ok(flow.calls.saves.length);
  assert.ok(
    flow.calls.emails[0].text.includes("Candidate Person") &&
      flow.calls.emails[0].text.includes("Example Company") &&
      flow.calls.emails[0].text.includes("Software Engineer") &&
      flow.calls.emails[0].text.includes("1 December 2099") &&
      flow.calls.emails[0].text.includes("10:30 AM") &&
      flow.calls.emails[0].text.includes("Online") &&
      flow.calls.emails[0].text.includes(interviewDetails.meetingLink),
  );
});

test("logs and skips interview email when the candidate has no registered email", async () => {
  const flow = createInterviewFlow({ candidateEmail: "" });
  const result = await invoke(
    flow,
    flow.controller.scheduleRecruiterInterview,
    interviewDetails,
  );

  assert.equal(result.responseStatus, 201);
  assert.equal(result.nextError, undefined);
  assert.ok(flow.application.interview);
  assert.equal(flow.calls.emails.length, 0);
  assert.equal(flow.calls.logs[0][0], "warn");
  assert.match(flow.calls.logs[0][1], /candidate email missing/);
});

test("keeps the saved interview and logs a safe error when email delivery fails", async () => {
  const deliveryError = Object.assign(
    new Error("SMTP failure with sensitive detail"),
    { category: "NETWORK_ERROR", code: "ETIMEDOUT" },
  );
  const flow = createInterviewFlow({ emailError: deliveryError });
  const result = await invoke(
    flow,
    flow.controller.scheduleRecruiterInterview,
    interviewDetails,
  );

  assert.equal(result.responseStatus, 201);
  assert.equal(result.nextError, undefined);
  assert.equal(flow.application.interview.date, interviewDetails.date);
  assert.equal(flow.calls.emails.length, 1);
  assert.equal(flow.calls.logs[0][0], "error");
  assert.equal(flow.calls.logs[0][2].category, "NETWORK_ERROR");
  assert.equal(
    JSON.stringify(flow.calls.logs).includes("sensitive detail"),
    false,
  );
});

test("does not resend an invitation when scheduling is retried for an existing interview", async () => {
  const flow = createInterviewFlow();
  const firstResult = await invoke(
    flow,
    flow.controller.scheduleRecruiterInterview,
    interviewDetails,
  );
  const retryResult = await invoke(
    flow,
    flow.controller.scheduleRecruiterInterview,
    interviewDetails,
  );

  assert.equal(firstResult.responseStatus, 201);
  assert.equal(retryResult.nextError.codeStatus, 409);
  assert.equal(flow.calls.emails.length, 1);
});

test("sends an updated invitation after an interview is rescheduled", async () => {
  const flow = createInterviewFlow({ hasInterview: true });
  const updatedDetails = {
    date: "2099-12-02",
    time: "11:45",
    mode: "online",
    meetingLink: "https://meet.example.com/updated-room",
  };
  const result = await invoke(
    flow,
    flow.controller.rescheduleRecruiterInterview,
    updatedDetails,
  );

  assert.equal(result.responseStatus, 200);
  assert.equal(result.nextError, undefined);
  assert.equal(flow.calls.emails.length, 1);
  assert.equal(
    flow.calls.emails[0].email,
    "candidate.registered@example.com",
  );
  assert.match(flow.calls.emails[0].subject, /Rescheduled/);
  assert.match(flow.calls.emails[0].text, /2 December 2099/);
  assert.match(flow.calls.emails[0].text, /11:45 AM/);
  assert.match(flow.calls.emails[0].text, /updated-room/);
});
