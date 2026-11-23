"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { afterEach, test } = require("node:test");

const backendPath = path.resolve(__dirname, "..");
const modulePaths = {
  adminController: path.join(
    backendPath,
    "controllers",
    "adminFeedbackController.js",
  ),
  userController: path.join(
    backendPath,
    "controllers",
    "userPlatformFeedbackController.js",
  ),
  recruiterController: path.join(
    backendPath,
    "controllers",
    "platformFeedbackController.js",
  ),
  errorResponse: path.join(backendPath, "utils", "errorResponse.js"),
  platformFeedback: path.join(
    backendPath,
    "models",
    "platformFeedbackModel.js",
  ),
  userPlatformFeedback: path.join(
    backendPath,
    "models",
    "userPlatformFeedbackModel.js",
  ),
  userHistory: path.join(backendPath, "models", "jobHistory.js"),
};

const originalModules = new Map();
let activeMocks;

const mockModule = (filePath, exports) => {
  if (!originalModules.has(filePath)) {
    originalModules.set(filePath, require.cache[filePath]);
  }
  require.cache[filePath] = {
    id: filePath,
    filename: filePath,
    loaded: true,
    exports,
  };
};

class ErrorResponse extends Error {
  constructor(message, codeStatus) {
    super(message);
    this.codeStatus = codeStatus;
  }
}

const createFeedbackController = (role) => {
  const calls = { created: [] };
  const modelPath =
    role === "User"
      ? modulePaths.userPlatformFeedback
      : modulePaths.platformFeedback;
  const model = {
    create: async (document) => {
      calls.created.push(document);
      return { _id: "saved-feedback-id", submittedAt: new Date(), ...document };
    },
  };
  mockModule(modulePaths.errorResponse, ErrorResponse);
  mockModule(modelPath, model);
  mockModule(
    role === "User" ? modulePaths.userController : modulePaths.recruiterController,
    {},
  );
  delete require.cache[
    role === "User" ? modulePaths.userController : modulePaths.recruiterController
  ];
  const controller = require(
    role === "User" ? modulePaths.userController : modulePaths.recruiterController,
  );
  activeMocks = { calls, controller };
  return activeMocks;
};

const invoke = async (handler, request) => {
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

  await handler(request, response, (error) => {
    nextError = error;
  });
  return { nextError, responseBody, responseStatus };
};

afterEach(() => {
  for (const [filePath, originalModule] of originalModules) {
    delete require.cache[filePath];
    if (originalModule) require.cache[filePath] = originalModule;
  }
  originalModules.clear();
  activeMocks = undefined;
});

for (const role of ["User", "Recruiter"]) {
  test(`${role} can submit text feedback with identity snapshots`, async () => {
    const flow = createFeedbackController(role);
    const isUser = role === "User";
    const handler = flow.controller[
      isUser ? "submitUserPlatformFeedback" : "submitRecruiterPlatformFeedback"
    ];
    const request = {
      body: { feedback: "  Helpful platform.  " },
      user: {
        _id: isUser ? "user-123" : "recruiter-123",
        firstName: "Taylor",
        lastName: "Candidate",
        email: "taylor@example.com",
        role: isUser ? 0 : 1,
      },
    };

    const guardResult = await invoke(handler[0], request);
    assert.equal(guardResult.nextError, undefined);
    const result = await invoke(handler[1], request);

    assert.equal(result.responseStatus, 201);
    assert.equal(result.nextError, undefined);
    assert.deepEqual(flow.calls.created[0], {
      [isUser ? "user" : "recruiter"]: request.user._id,
      name: "Taylor Candidate",
      email: "taylor@example.com",
      role,
      feedback: "Helpful platform.",
    });
  });

  test(`${role} cannot submit an empty feedback message`, async () => {
    const flow = createFeedbackController(role);
    const isUser = role === "User";
    const handler = flow.controller[
      isUser ? "submitUserPlatformFeedback" : "submitRecruiterPlatformFeedback"
    ];
    const request = {
      body: { feedback: "   " },
      user: {
        _id: isUser ? "user-123" : "recruiter-123",
        role: isUser ? 0 : 1,
      },
    };

    const result = await invoke(handler[1], request);

    assert.equal(result.nextError.codeStatus, 400);
    assert.equal(flow.calls.created.length, 0);
  });
}

test("admin feedback list includes user platform feedback with identity", async () => {
  const platformEntry = {
    _id: "user-feedback-123",
    user: {
      firstName: "Taylor",
      lastName: "Candidate",
      email: "taylor@example.com",
    },
    name: "Taylor Candidate",
    email: "taylor@example.com",
    role: "User",
    feedback: "Helpful platform.",
    submittedAt: new Date("2030-01-02T03:04:05.000Z"),
  };
  const chain = (entries) => ({
    sort() {
      return this;
    },
    populate() {
      return this;
    },
    lean: async () => entries,
  });

  mockModule(modulePaths.errorResponse, ErrorResponse);
  mockModule(modulePaths.platformFeedback, { find: () => chain([]) });
  mockModule(modulePaths.userPlatformFeedback, {
    find: (filter) => {
      assert.deepEqual(filter, {});
      return chain([platformEntry]);
    },
  });
  mockModule(modulePaths.userHistory, { find: () => chain([]) });
  delete require.cache[modulePaths.adminController];
  const controller = require(modulePaths.adminController);
  activeMocks = { controller };

  const result = await invoke(controller.getAdminFeedback, {
    query: { role: "user" },
  });

  assert.equal(result.responseStatus, 200);
  assert.equal(result.responseBody.feedback.length, 1);
  assert.deepEqual(
    {
      _id: result.responseBody.feedback[0]._id,
      senderName: result.responseBody.feedback[0].senderName,
      senderEmail: result.responseBody.feedback[0].senderEmail,
      senderRole: result.responseBody.feedback[0].senderRole,
      message: result.responseBody.feedback[0].message,
      feedbackType: result.responseBody.feedback[0].feedbackType,
    },
    {
      _id: "upf_user-feedback-123",
      senderName: "Taylor Candidate",
      senderEmail: "taylor@example.com",
      senderRole: "User",
      message: "Helpful platform.",
      feedbackType: "user_platform",
    },
  );
});
