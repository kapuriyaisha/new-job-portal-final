"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { beforeEach, test } = require("node:test");

const backendPath = path.resolve(__dirname, "..");
const userPath = path.join(backendPath, "models", "userModel.js");
const controllerPath = path.join(backendPath, "controllers", "chatController.js");

let users;
let lastQuery;

const matchesQuery = (user, query) =>
  query.role.$in.includes(Number(user.role)) &&
  String(user._id) !== String(query._id.$ne) &&
  user.isDeleted !== true &&
  user.isActive !== false &&
  user.isEmailVerified !== false;

class FakeUser {
  static find(query) {
    lastQuery = query;
    return {
      select() {
        return this;
      },
      async lean() {
        return users.filter((user) => matchesQuery(user, query));
      },
    };
  }
}

require.cache[userPath] = {
  id: userPath,
  filename: userPath,
  loaded: true,
  exports: FakeUser,
};

const chat = require(controllerPath);

const getContacts = (user) =>
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
    chat.getChatContacts({ user }, res, reject);
  });

beforeEach(() => {
  users = [
    { _id: "applicant", role: 0, firstName: "Ava", lastName: "Applicant", profilePhoto: "/ava.png" },
    { _id: "other-applicant", role: 0, firstName: "Noah", lastName: "Applicant", profilePhoto: "/noah.png" },
    { _id: "recruiter", role: 1, firstName: "Riley", lastName: "Recruiter", profilePhoto: "/riley.png" },
    { _id: "deleted-recruiter", role: 1, firstName: "Old", lastName: "Recruiter", isDeleted: true },
    { _id: "inactive-recruiter", role: 1, firstName: "Inactive", lastName: "Recruiter", isActive: false },
    { _id: "unverified-recruiter", role: 1, firstName: "Pending", lastName: "Recruiter", isEmailVerified: false },
    { _id: "admin", role: 2, firstName: "Admin", lastName: "Account" },
  ];
  lastQuery = null;
});

test("applicant chat contacts are active recruiters only", async () => {
  const result = await getContacts({ _id: "applicant", role: 0 });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body.contacts, [
    {
      uid: "recruiter",
      name: "Riley Recruiter",
      avatar: "/riley.png",
    },
  ]);
  assert.deepEqual(lastQuery.role.$in, [1]);
  assert.equal(String(lastQuery._id.$ne), "applicant");
});

test("recruiter chat contacts are active applicants only", async () => {
  const result = await getContacts({ _id: "recruiter", role: 1 });

  assert.equal(result.status, 200);
  assert.deepEqual(
    result.body.contacts.map(({ uid }) => uid),
    ["applicant", "other-applicant"],
  );
  assert.deepEqual(lastQuery.role.$in, [0]);
  assert.equal(result.body.contacts.some((contact) => "email" in contact), false);
});

test("admin contacts exclude admin accounts and include only active portal roles", async () => {
  const result = await getContacts({ _id: "admin", role: 2 });

  assert.equal(result.status, 200);
  assert.deepEqual(lastQuery.role.$in, [0, 1]);
  assert.equal(result.body.contacts.some((contact) => contact.uid === "admin"), false);
  assert.equal(result.body.contacts.some((contact) => contact.uid === "deleted-recruiter"), false);
});
