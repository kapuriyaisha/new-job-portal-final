"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const https = require("node:https");
const { afterEach, test } = require("node:test");
const { generateRecruitmentEmail } = require("../services/resumeAnalyzerService");

const originalRequest = https.request;
const originalApiKey = process.env.GROQ_API_KEY;

afterEach(() => {
  https.request = originalRequest;
  if (originalApiKey === undefined) {
    delete process.env.GROQ_API_KEY;
  } else {
    process.env.GROQ_API_KEY = originalApiKey;
  }
});

test("uses the existing Groq integration to generate a selected-tone draft", async () => {
  let requestOptions;
  let requestBody;
  https.request = (options, onResponse) => {
    requestOptions = options;
    const request = new EventEmitter();
    request.write = (body) => {
      requestBody = JSON.parse(body);
    };
    request.end = () => {
      const response = new EventEmitter();
      onResponse(response);
      process.nextTick(() => {
        response.emit(
          "data",
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    subject: "Interview with Example Company",
                    body: "Hello Candidate Person, let's discuss the role.",
                  }),
                },
              },
            ],
          }),
        );
        response.emit("end");
      });
    };
    return request;
  };
  process.env.GROQ_API_KEY = "test-only";

  const draft = await generateRecruitmentEmail({
    candidateName: "Candidate Person",
    jobTitle: "Software Engineer",
    companyName: "Example Company",
    emailType: "Interview Invitation",
    tone: "friendly",
  });

  assert.equal(requestOptions.hostname, "api.groq.com");
  assert.deepEqual(draft, {
    subject: "Interview with Example Company",
    body: "Hello Candidate Person, let's discuss the role.",
  });
  assert.match(requestBody.messages[0].content, /Candidate Person/);
  assert.match(requestBody.messages[0].content, /Software Engineer/);
  assert.match(requestBody.messages[0].content, /Interview Invitation/);
  assert.match(requestBody.messages[0].content, /friendly/);
});
