import { CometChat } from "@cometchat-pro/chat";
import axios from "axios";
import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { CometChatUI } from "../../cometchat-pro-react-ui-kit/CometChatWorkspace/src/components/CometChatUI";
import { UIKitSettings } from "../../cometchat-pro-react-ui-kit/CometChatWorkspace/src/util/UIKitSettings";

// Wrapper: sets UIKitSettings._defaultUserListMode before CometChatUI mounts
// and clears it on unmount so other chat pages are unaffected.
const UIKitSettingsScope = ({ mode, children }) => {
  UIKitSettings._defaultUserListMode = mode;
  useEffect(() => () => { UIKitSettings._defaultUserListMode = null; }, []);
  return children;
};

const UserChat = () => {
  const { userInfo } = useSelector((state) => state.signIn);
  const [chatReady, setChatReady] = useState(false);
  const [chatError, setChatError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loginToChat = async () => {
      if (!userInfo) return;

      try {
        if (!CometChat.isInitialized()) {
          throw new Error("Chat service is still initializing. Refresh and try again.");
        }

        const { data } = await axios.post(
          "/api/chat/provision",
          {},
          { withCredentials: true },
        );
        if (!data?.uid || !data?.authToken) {
          throw new Error("The chat service returned invalid login details.");
        }

        // Log out any different CometChat session open in this browser tab.
        const loggedInUser = await CometChat.getLoggedinUser().catch(() => null);
        if (loggedInUser && loggedInUser.getUid() !== data.uid) {
          await CometChat.logout();
        }

        if (!loggedInUser || loggedInUser.getUid() !== data.uid) {
          await CometChat.login(data.authToken);
        }

        if (!cancelled) setChatReady(true);
      } catch (err) {
        if (!cancelled) {
          setChatError(
            err?.response?.data?.error || err?.message || "Unable to connect to chat.",
          );
        }
      }
    };

    loginToChat();
    return () => { cancelled = true; };
  }, [userInfo]);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        height: "800px",
        marginTop: "25px",
      }}
    >
      {chatError && (
        <p style={{ color: "red", padding: "16px" }}>{chatError}</p>
      )}
      {!chatError && !chatReady && (
        <p style={{ padding: "16px" }}>Connecting to chat…</p>
      )}
      {chatReady && (
        <UIKitSettingsScope mode={UIKitSettings.userListFilterOptions.ALL}>
          <CometChatUI />
        </UIKitSettingsScope>
      )}
    </div>
  );
};

export default UserChat;
