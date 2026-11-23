"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { afterEach, test } = require("node:test");

const backendPath = path.resolve(__dirname, "..");
const modulePaths = {
  controller: path.join(
    backendPath,
    "controllers",
    "recruiterEmailController.js",
  ),
  errorResponse: path.join(backendPath, "utils", "errorResponse.js"),
  job: path.join(backendPath, "models", "jobModel.js"),
  user: path.join(backendPath, "models", "userModel.js"),
  history: path.join(backendPath, "models", "jobHistory.js"),
  emailHistory: path.join(backendPath, "models", "recruiterEmailHistory.js"),
  email: path.join(backendPath, "utils", "email.js"),
  ai: path.join(backendPath, "services", "resumeAnalyzerService.js"),
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

const createEmailFlow = ({
  candidateEmail = "candidate@example.com",
  ownedJob = true,
  deliveryError,
  historyError,
} = {}) => {
  const calls = {
    ai: [],
    emails: [],
    errors: [],
    history: [],
    order: [],
    ownershipFilters: [],
  };
  const application = {
    _id: "application-123",
    user: "candidate-456",
    jobId: "job-789",
  };
  const job = {
    _id: "job-789",
    title: "Software Engineer",
    companyName: "Example Company",
  };
  const candidate = {
    _id: "candidate-456",
    firstName: "Candidate",
    lastName: "Person",
    email: candidateEmail,
  };

  class ErrorResponse extends Error {
    constructor(message, codeStatus) {
      super(message);
      this.codeStatus = codeStatus;
    }
  }

  mockModule(modulePaths.errorResponse, ErrorResponse);
  mockModule(modulePaths.history, {
    findById: () => ({ lean: async () => application }),
  });
  mockModule(modulePaths.job, {
    findOne: (filter) => {
      calls.ownershipFilters.push(filter);
      return {
        select: () => ({ lean: async () => (ownedJob ? job : null) }),
      };
    },
  });
  mockModule(modulePaths.user, {
    findById: () => ({
      select: () => ({ lean: async () => candidate }),
    }),
  });
  mockModule(modulePaths.emailHistory, {
    create: async (record) => {
      calls.order.push("history");
      if (historyError) throw historyError;
      calls.history.push(record);
      return { ...record, sentAt: record.sentAt };
    },
  });
  mockModule(modulePaths.email, async (message) => {
    calls.order.push("email");
    calls.emails.push(message);
    if (deliveryError) throw deliveryError;
  });
  mockModule(modulePaths.ai, {
    generateRecruitmentEmail: async (options) => {
      calls.ai.push(options);
      return { subject: "A role update", body: "Hello Candidate Person" };
    },
  });

  const originalConsoleError = console.error;
  console.error = (...args) => calls.errors.push(args);
  originalModules.set(
    modulePaths.controller,
    require.cache[modulePaths.controller],
  );
  delete require.cache[modulePaths.controller];
  const controller = require(modulePaths.controller);

  activeMocks = { application, calls, controller, job, originalConsoleError };
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
    { body, user: { _id: "recruiter-321" } },
    response,
    (error) => {
      nextError = error;
    },
  );
  return { responseBody, responseStatus, nextError };
};

const validEmailRequest = {
  applicationId: "application-123",
  emailType: "interview_invitation",
  tone: "professional",
};

afterEach(() => {
  if (activeMocks) console.error = activeMocks.originalConsoleError;
  for (const [filePath, originalModule] of originalModules) {
    delete require.cache[filePath];
    if (originalModule) require.cache[filePath] = originalModule;
  }
  originalModules = new Map();
  activeMocks = undefined;
});

test("generates a draft using the selected recruiter's own candidate and job", async () => {
  const flow = createEmailFlow();
  const result = await invoke(
    flow,
    flow.controller.generateRecruitmentEmail,
    validEmailRequest,
  );

  assert.equal(result.responseStatus, 200);
  assert.deepEqual(result.responseBody, {
    success: true,
    subject: "A role update",
    body: "Hello Candidate Person",
  });
  assert.deepEqual(flow.calls.ai[0], {
    candidateName: "Candidate Person",
    jobTitle: "Software Engineer",
    companyName: "Example Company",
    emailType: "Interview Invitation",
    tone: "professional",
  });
  assert.equal(flow.calls.ownershipFilters[0].user, "recruiter-321");
});

test("does not generate drafts for applications outside the recruiter's jobs", async () => {
  const flow = createEmailFlow({ ownedJob: false });
  const result = await invoke(
    flow,
    flow.controller.generateRecruitmentEmail,
    validEmailRequest,
  );

  assert.equal(result.nextError.codeStatus, 404);
  assert.equal(flow.calls.ai.length, 0);
});

test("sends to the candidate's registered email and saves successful email history", async () => {
  const flow = createEmailFlow();
  const result = await invoke(flow, flow.controller.sendRecruitmentEmail, {
    ...validEmailRequest,
    subject: "A role update",
    body: "Hello Candidate Person",
  });

  assert.equal(result.responseStatus, 200);
  assert.equal(result.responseBody.success, true);
  assert.equal(flow.calls.emails[0].email, "candidate@example.com");
  assert.equal(flow.calls.emails[0].text, "Hello Candidate Person");
  assert.deepEqual(flow.calls.order, ["email", "history"]);
  assert.deepEqual(
    {
      candidateId: flow.calls.history[0].candidateId,
      recruiterId: flow.calls.history[0].recruiterId,
      jobId: flow.calls.history[0].jobId,
      emailType: flow.calls.history[0].emailType,
    },
    {
      candidateId: "candidate-456",
      recruiterId: "recruiter-321",
      jobId: "job-789",
      emailType: "interview_invitation",
    },
  );
});

test("rejects candidates without a registered email and never attempts delivery", async () => {
  const flow = createEmailFlow({ candidateEmail: "" });
  const result = await invoke(flow, flow.controller.sendRecruitmentEmail, {
    ...validEmailRequest,
    subject: "A role update",
    body: "Hello Candidate Person",
  });

  assert.equal(result.nextError.codeStatus, 400);
  assert.match(result.nextError.message, /registered email/);
  assert.equal(flow.calls.emails.length, 0);
  assert.equal(flow.calls.history.length, 0);
});

test("returns a safe error and does not record an email when delivery fails", async () => {
  const flow = createEmailFlow({
    deliveryError: Object.assign(new Error("private smtp response"), {
      category: "NETWORK_ERROR",
      code: "ETIMEDOUT",
    }),
  });
  const result = await invoke(flow, flow.controller.sendRecruitmentEmail, {
    ...validEmailRequest,
    subject: "A role update",
    body: "Hello Candidate Person",
  });

  assert.equal(result.nextError.codeStatus, 502);
  assert.equal(result.nextError.message, "Unable to send email. Please try again.");
  assert.equal(flow.calls.history.length, 0);
  assert.equal(JSON.stringify(flow.calls.errors).includes("private smtp response"), false);
});

test("reports successful delivery if history persistence fails, without inviting a resend", async () => {
  const flow = createEmailFlow({
    historyError: Object.assign(new Error("database detail"), { code: "DB_ERROR" }),
  });
  const result = await invoke(flow, flow.controller.sendRecruitmentEmail, {
    ...validEmailRequest,
    subject: "A role update",
    body: "Hello Candidate Person",
  });

  assert.equal(result.responseStatus, 200);
  assert.equal(result.responseBody.success, true);
  assert.equal(result.responseBody.historySaved, false);
  assert.equal(flow.calls.emails.length, 1);
  assert.equal(JSON.stringify(flow.calls.errors).includes("database detail"), false);
});
