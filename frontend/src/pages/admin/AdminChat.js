import React, { useEffect, useState } from "react";
import { CometChatUI } from "../../cometchat-pro-react-ui-kit/CometChatWorkspace/src/components/CometChatUI";
import { CometChat } from "@cometchat-pro/chat";
import axios from "axios";
import { useSelector } from "react-redux";

const AdminChat = () => {
  const [chatReady, setChatReady] = useState(false);
  const [chatError, setChatError] = useState("");
  const { userInfo } = useSelector((state) => state.signIn);

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
      } catch (error) {
        if (!cancelled) {
          setChatError(
            error?.response?.data?.error ||
              error?.message ||
              "Unable to connect to chat.",
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
        height: "700px",
        marginTop: "25px",
        backgroundColor: "#F2F2F2",
      }}
    >
      {chatError && <p style={{ color: "red", padding: "16px" }}>{chatError}</p>}
      {!chatError && !chatReady && (
        <p style={{ padding: "16px" }}>Connecting to chat...</p>
      )}
      {chatReady && <CometChatUI />}
    </div>
  );
};

export default AdminChat;
