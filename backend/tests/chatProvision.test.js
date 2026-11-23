"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const https = require("node:https");
const { afterEach, beforeEach, test } = require("node:test");

process.env.COMETCHAT_APP_ID = "test-app";
process.env.COMETCHAT_REGION = "in";
process.env.COMETCHAT_REST_API_KEY = "test-rest-key";

const originalRequest = https.request;
const chat = require("../controllers/chatController");

let responses;
let calls;

const mockRequest = (options, callback) => {
  const request = new EventEmitter();
  let payload = "";
  request.write = (chunk) => {
    payload += chunk;
  };
  request.end = () => {
    calls.push({ options, payload });
    const responseData = responses.shift();
    const response = new EventEmitter();
    response.statusCode = responseData.status;
    callback(response);
    process.nextTick(() => {
      response.emit("data", JSON.stringify(responseData.body));
      response.emit("end");
    });
  };
  return request;
};

const provision = (user) =>
  new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        resolve({ status: this.statusCode, body });
      },
    };
    chat.provisionChatUser({ user }, res, reject);
  });

beforeEach(() => {
  responses = [];
  calls = [];
  https.request = mockRequest;
});

afterEach(() => {
  https.request = originalRequest;
});

test("provision uses MongoDB UID and keeps REST credentials server-side", async () => {
  responses = [
    { status: 201, body: { data: { user: { uid: "db-recruiter-id" } } } },
    { status: 201, body: { data: { authToken: "short-lived-token" } } },
  ];

  const result = await provision({
    _id: "db-recruiter-id",
    firstName: "Riley",
    lastName: "Recruiter",
    profilePhoto: "https://example.test/profile.png",
    role: 1,
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    uid: "db-recruiter-id",
    authToken: "short-lived-token",
  });
  assert.equal(calls[0].options.path, "/v3/users");
  assert.deepEqual(JSON.parse(calls[0].payload), {
    uid: "db-recruiter-id",
    name: "Riley Recruiter",
    avatar: "https://example.test/profile.png",
    tags: ["recruiter"],
  });
  assert.equal(calls[1].options.path, "/v3/users/db-recruiter-id/auth_tokens");
});

test("existing applicants are updated with their current MongoDB profile", async () => {
  responses = [
    {
      status: 400,
      body: { error: { code: "ERR_UID_ALREADY_EXISTS" } },
    },
    { status: 200, body: { data: { user: { uid: "db-applicant-id" } } } },
    { status: 201, body: { data: { authToken: "short-lived-token" } } },
  ];

  const result = await provision({
    _id: "db-applicant-id",
    firstName: "Ava",
    lastName: "Applicant",
    profilePhoto: "https://example.test/applicant.png",
    role: 0,
  });

  assert.equal(result.status, 200);
  assert.equal(calls[1].options.method, "PUT");
  assert.deepEqual(JSON.parse(calls[1].payload), {
    uid: "db-applicant-id",
    name: "Ava Applicant",
    avatar: "https://example.test/applicant.png",
  });
});
