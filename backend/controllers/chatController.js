/**
 * chatController.js
 *
 * Server-side CometChat user provisioning.
 * The REST API Key must never reach the browser — this controller calls the
 * CometChat REST API and returns only a short-lived Auth Token to the client.
 *
 * MongoDB is the source of truth for active chat contacts. CometChat users
 * remain in the provider so existing message history is preserved.
 */

const https = require("https");
const User = require("../models/userModel");

const APP_ID       = process.env.COMETCHAT_APP_ID;
const REGION       = (process.env.COMETCHAT_REGION || "in").toLowerCase();
const REST_API_KEY = process.env.COMETCHAT_REST_API_KEY;

// Thin HTTPS wrapper — no extra npm deps needed.
const cometFetch = (method, path, body) =>
  new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: `${APP_ID}.api-${REGION}.cometchat.io`,
      path: `/v3/${path}`,
      method,
      headers: {
        "Content-Type":  "application/json",
        Accept:          "application/json",
        apiKey:          REST_API_KEY,
        appId:           APP_ID,
      },
    };
    if (payload) options.headers["Content-Length"] = Buffer.byteLength(payload);

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });

const chatUserPayload = (user) => {
  const uid = String(user._id);
  const name =
    `${user.firstName || ""} ${user.lastName || ""}`.trim() || uid;
  const payload = { uid, name };
  if (user.profilePhoto) payload.avatar = user.profilePhoto;
  if (Number(user.role) === 1) payload.tags = ["recruiter"];
  return payload;
};

exports.ensureCometChatUser = async (user) => {
  if (!APP_ID || !REST_API_KEY) {
    const error = new Error("Chat service is not configured.");
    error.code = "CHAT_NOT_CONFIGURED";
    throw error;
  }

  const payload = chatUserPayload(user);
  const createResp = await cometFetch("POST", "users", payload);

  if (
    createResp.status === 400 &&
    createResp.body?.error?.code === "ERR_UID_ALREADY_EXISTS"
  ) {
    const updateResp = await cometFetch(
      "PUT",
      `users/${encodeURIComponent(payload.uid)}`,
      payload,
    );
    if (updateResp.status !== 200 && updateResp.status !== 201) {
      const error = new Error("CometChat user update failed.");
      error.code = "CHAT_USER_UPDATE_FAILED";
      throw error;
    }
    return payload.uid;
  }

  if (createResp.status !== 200 && createResp.status !== 201) {
    const error = new Error("CometChat user creation failed.");
    error.code = "CHAT_USER_CREATE_FAILED";
    throw error;
  }

  return payload.uid;
};

// GET /api/chat/contacts
// MongoDB controls visibility; stale CometChat records are never returned.
const buildChatContactsQuery = (viewer) => {
  const role = Number(viewer.role);
  if (![0, 1, 2].includes(role)) return null;

  const targetRoles = role === 0 ? [1] : role === 1 ? [0] : [0, 1];
  return {
    role: { $in: targetRoles },
    _id: { $ne: viewer._id },
    isDeleted: { $ne: true },
    isActive: { $ne: false },
    isEmailVerified: { $ne: false },
  };
};

exports.buildChatContactsQuery = buildChatContactsQuery;

exports.getChatContacts = async (req, res, next) => {
  try {
    const query = buildChatContactsQuery(req.user);
    if (!query) {
      return res.status(403).json({ error: "Chat contacts are unavailable." });
    }

    const contacts = await User.find(query)
      .select("_id firstName lastName profilePhoto")
      .lean();

    return res.status(200).json({
      success: true,
      contacts: contacts.map((contact) => ({
        uid: String(contact._id),
        name:
          `${contact.firstName || ""} ${contact.lastName || ""}`.trim() ||
          String(contact._id),
        avatar: contact.profilePhoto || "",
      })),
    });
  } catch (err) {
    return next(err);
  }
};

// POST /api/chat/provision
// Protected by isAuthenticated — req.user is the verified DB user.
exports.provisionChatUser = async (req, res, next) => {
  try {
    const uid = await exports.ensureCometChatUser(req.user);

    // Request a fresh Auth Token for this UID.
    const tokenResp = await cometFetch("POST", `users/${uid}/auth_tokens`, {});
    if (tokenResp.status !== 200 && tokenResp.status !== 201) {
      return res
        .status(502)
        .json({ error: "CometChat auth token request failed." });
    }

    const authToken = tokenResp.body?.data?.authToken;
    if (!authToken) {
      return res
        .status(502)
        .json({ error: "CometChat returned no auth token." });
    }

    // Return only uid + authToken — REST key stays on the server.
    return res.status(200).json({ uid, authToken });
  } catch (err) {
    if (err.code === "CHAT_NOT_CONFIGURED") {
      return res.status(503).json({ error: err.message });
    }
    if (
      err.code === "CHAT_USER_CREATE_FAILED" ||
      err.code === "CHAT_USER_UPDATE_FAILED"
    ) {
      return res.status(502).json({ error: err.message });
    }
    return next(err);
  }
};
