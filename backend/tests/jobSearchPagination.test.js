"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { beforeEach, test } = require("node:test");

const backendPath = path.resolve(__dirname, "..");
const jobModelPath = path.join(backendPath, "models", "jobModel.js");
const controllerPath = path.join(
  backendPath,
  "controllers",
  "jobSearchController.js",
);

let jobs;
let paginationRequests;
let queries;

class FakeJob {
  static find(query, projection) {
    queries.push(query);
    if (projection) {
      return {
        lean: async () => jobs.map(({ location }) => ({ location })),
      };
    }

    return {
      offset: 0,
      limitValue: 0,
      countDocuments: async () => jobs.length,
      sort() {
        return this;
      },
      populate() {
        return this;
      },
      skip(value) {
        this.offset = value;
        return this;
      },
      limit(value) {
        this.limitValue = value;
        paginationRequests.push({ offset: this.offset, limit: value });
        return this;
      },
      then(resolve, reject) {
        return Promise.resolve(
          jobs.slice(this.offset, this.offset + this.limitValue),
        ).then(resolve, reject);
      },
    };
  }
}

require.cache[jobModelPath] = {
  id: jobModelPath,
  filename: jobModelPath,
  loaded: true,
  exports: FakeJob,
};

const { showJobs } = require(controllerPath);

const loadJobs = (query) =>
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
    showJobs({ query }, res, reject);
  });

beforeEach(() => {
  jobs = [];
  paginationRequests = [];
  queries = [];
});

test("paginates 12 and 13 jobs in complete groups of six", async () => {
  for (const total of [12, 13]) {
    jobs = Array.from({ length: total }, (_, index) => ({
      _id: `job-${index + 1}`,
      location: `City ${index % 2}`,
    }));
    const received = [];
    const expectedPages = Math.ceil(total / 6);

    for (let pageNumber = 1; pageNumber <= expectedPages; pageNumber += 1) {
      const { status, body } = await loadJobs({ pageNumber });

      assert.equal(status, 200);
      assert.equal(body.pages, expectedPages);
      assert.equal(body.count, total);
      assert.equal(body.page, pageNumber);
      assert.equal(
        body.jobs.length,
        Math.min(6, total - (pageNumber - 1) * 6),
      );
      received.push(...body.jobs.map((job) => job._id));
    }

    assert.deepEqual(
      received,
      jobs.map((job) => job._id),
    );
  }
});

test("applies six-item pagination to keyword and category searches", async () => {
  jobs = Array.from({ length: 13 }, (_, index) => ({
    _id: `job-${index + 1}`,
    location: "Remote",
  }));

  const { body } = await loadJobs({ pageNumber: 2, keyword: "Engineering" });

  assert.equal(body.pages, 3);
  assert.equal(body.jobs.length, 6);
  assert.deepEqual(paginationRequests.at(-1), { offset: 6, limit: 6 });
  assert.match(queries[1].$or[0].title.$regex, /Engineering/);
});
