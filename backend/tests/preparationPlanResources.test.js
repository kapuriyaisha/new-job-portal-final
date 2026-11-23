"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const https = require("node:https");
const path = require("node:path");
const { test } = require("node:test");

const servicePath = path.resolve(
  __dirname,
  "..",
  "services",
  "resumeAnalyzerService.js",
);
const { generatePreparationPlan } = require(servicePath);

test("adds a skill-specific YouTube search resource for every topic and skill", async () => {
  const skills = ["JavaScript", "React", "Node.js", "MongoDB"];
  const generatedPlan = skills.map((skill, index) => ({
    skill,
    priority: "high",
    keyTopics: [
      {
        topic: `${skill} fundamentals`,
        resources: [
          { title: "Official documentation", url: "https://developer.mozilla.org/" },
          {
            title: "AI-provided YouTube search",
            url: "https://www.youtube.com/results?search_query=unrelated",
          },
        ],
      },
      {
        topic: `${skill} project patterns ${index + 1}`,
        resources: [],
      },
    ],
  }));
  const originalRequest = https.request;
  const originalApiKey = process.env.GROQ_API_KEY;

  https.request = (_options, onResponse) => {
    const request = new EventEmitter();
    request.write = () => {};
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
                  content: JSON.stringify(generatedPlan),
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

  try {
    const plan = await generatePreparationPlan(
      { title: "Full Stack Developer", description: "" },
      [],
      skills,
    );

    assert.equal(plan.length, skills.length);
    for (const [skillIndex, item] of plan.entries()) {
      assert.equal(item.skill, skills[skillIndex]);
      assert.equal(item.keyTopics.length, 2);

      for (const [topicIndex, keyTopic] of item.keyTopics.entries()) {
        const searchResource = keyTopic.resources.find((resource) =>
          resource.url.startsWith("https://www.youtube.com/results?search_query="),
        );
        const expectedQuery = `${item.skill} ${keyTopic.topic} tutorial`;

        assert.ok(searchResource, `${item.skill} - ${keyTopic.topic}`);
        assert.equal(
          searchResource.url,
          `https://www.youtube.com/results?search_query=${encodeURIComponent(expectedQuery)}`,
        );
        assert.ok(searchResource.title.includes(item.skill));
        assert.ok(searchResource.title.includes(keyTopic.topic));
        if (topicIndex === 0) {
          assert.equal(
            keyTopic.resources.some(
              (resource) => resource.title === "Official documentation",
            ),
            true,
          );
        }
        assert.equal(
          keyTopic.resources.some((resource) =>
            resource.title === "AI-provided YouTube search",
          ),
          false,
        );
      }
    }
  } finally {
    https.request = originalRequest;
    if (originalApiKey === undefined) {
      delete process.env.GROQ_API_KEY;
    } else {
      process.env.GROQ_API_KEY = originalApiKey;
    }
  }
});
