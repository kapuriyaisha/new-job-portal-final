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
let lastQuery;
let recruiterMatch;

const isActiveJob = (job) =>
  job.isDeleted === false &&
  job.available === true &&
  job.applicationDeadline >= lastQuery.applicationDeadline.$gte &&
  job.user &&
  Number(job.user.role) === recruiterMatch.role &&
  job.user.isDeleted !== true &&
  job.user.isActive !== false &&
  job.user.isEmailVerified !== false;

class FakeJob {
  static find(query) {
    lastQuery = query;
    return {
      sort() {
        return this;
      },
      select() {
        return this;
      },
      populate(options) {
        recruiterMatch = options.match;
        return this;
      },
      async lean() {
        return jobs.filter(isActiveJob);
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

const { getActivelyHiringCompanies } = require(controllerPath);

const loadCompanies = () =>
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
    getActivelyHiringCompanies({}, res, reject);
  });

beforeEach(() => {
  const future = new Date("2099-01-01T00:00:00.000Z");
  const recruiter = (id, name) => ({
    _id: id,
    role: 1,
    companyName: name,
    profilePhoto: `/logos/${id}.png`,
  });
  jobs = Array.from({ length: 6 }, (_, index) => ({
    isDeleted: false,
    available: true,
    applicationDeadline: future,
    companyName: `Company ${index + 1}`,
    location: `City ${index + 1}`,
    user: recruiter(`recruiter-${index + 1}`, `Company ${index + 1}`),
  }));
  jobs.push({
    isDeleted: false,
    available: true,
    applicationDeadline: future,
    companyName: " company 1 ",
    location: "Another city",
    user: recruiter("recruiter-1", "Company 1"),
  });
  jobs.push(
    {
      isDeleted: false,
      available: false,
      applicationDeadline: future,
      companyName: "Unavailable",
      user: recruiter("unavailable", "Unavailable"),
    },
    {
      isDeleted: true,
      available: true,
      applicationDeadline: future,
      companyName: "Deleted",
      user: recruiter("deleted", "Deleted"),
    },
    {
      isDeleted: false,
      available: true,
      applicationDeadline: new Date("2000-01-01T00:00:00.000Z"),
      companyName: "Expired",
      user: recruiter("expired", "Expired"),
    },
    {
      isDeleted: false,
      available: true,
      applicationDeadline: future,
      companyName: "Inactive Recruiter",
      user: { ...recruiter("inactive", "Inactive Recruiter"), isActive: false },
    },
  );
  lastQuery = null;
  recruiterMatch = null;
});

test("returns all active companies and live opening counts", async () => {
  const result = await loadCompanies();

  assert.equal(result.status, 200);
  assert.equal(result.body.companyCount, 6);
  assert.equal(result.body.openingCount, 7);
  assert.equal(result.body.companies.length, 6);
  assert.equal(result.body.companies[0].name, "Company 1");
  assert.equal(result.body.companies[0].openings, 2);
  assert.equal(result.body.companies.some((company) => company.name === "Expired"), false);
  assert.deepEqual(lastQuery, {
    isDeleted: false,
    available: true,
    applicationDeadline: { $gte: lastQuery.applicationDeadline.$gte },
  });
  assert.equal(recruiterMatch.role, 1);
  assert.deepEqual(recruiterMatch.isDeleted, { $ne: true });
  assert.deepEqual(recruiterMatch.isActive, { $ne: false });
});
