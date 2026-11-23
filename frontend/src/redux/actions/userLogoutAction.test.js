import axios from "axios";
import { userLogoutAction, userProfileAction } from "./userAction";
import {
  USER_LOAD_FAIL,
  USER_LOAD_REQUEST,
  USER_LOAD_SUCCESS,
  USER_LOGOUT_REQUEST,
  USER_LOGOUT_SUCCESS,
} from "../constants/userConstant";

jest.mock("axios", () => ({
  get: jest.fn(),
}));

describe("userLogoutAction", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = "token=active; path=/";
    axios.get.mockReset();
  });

  test("clears client auth state without calling the broken profile route", async () => {
    localStorage.setItem("userInfo", JSON.stringify({ role: { role: 1 } }));
    const dispatch = jest.fn();

    await userLogoutAction()(dispatch);

    expect(localStorage.getItem("userInfo")).toBeNull();
    expect(document.cookie).not.toContain("token=active");
    expect(axios.get).not.toHaveBeenCalled();
    expect(dispatch.mock.calls).toEqual([
      [{ type: USER_LOGOUT_REQUEST }],
      [{ type: USER_LOGOUT_SUCCESS }],
    ]);
  });

  test("clears a persisted session when its account no longer exists", async () => {
    localStorage.setItem(
      "userInfo",
      JSON.stringify({ role: { _id: "deleted-user", role: 0 } }),
    );
    axios.get.mockRejectedValue({
      response: {
        status: 401,
        data: { error: "Not authorized to access this route" },
      },
    });
    const dispatch = jest.fn();

    await userProfileAction()(dispatch);

    expect(localStorage.getItem("userInfo")).toBeNull();
    expect(document.cookie).not.toContain("token=active");
    expect(dispatch.mock.calls).toEqual([
      [{ type: USER_LOAD_REQUEST }],
      [{ type: USER_LOGOUT_SUCCESS }],
      [
        {
          type: USER_LOAD_FAIL,
          payload: "Not authorized to access this route",
        },
      ],
    ]);
  });

  test("uses a readable fallback when profile loading rejects with a browser event", async () => {
    axios.get.mockRejectedValue(new Event("error"));
    const dispatch = jest.fn();

    await userProfileAction()(dispatch);

    expect(dispatch).toHaveBeenLastCalledWith({
      type: USER_LOAD_FAIL,
      payload: "Unable to load profile. Please sign in again.",
    });
  });

  test("keeps a valid Admin session after the profile request succeeds", async () => {
    const admin = { _id: "admin-123", role: 2, email: "admin@example.com" };
    localStorage.setItem("userInfo", JSON.stringify({ role: admin }));
    axios.get.mockResolvedValue({ data: { user: admin } });
    const dispatch = jest.fn();

    await userProfileAction()(dispatch);

    expect(localStorage.getItem("userInfo")).not.toBeNull();
    expect(dispatch).toHaveBeenLastCalledWith({
      type: USER_LOAD_SUCCESS,
      payload: { user: admin },
    });
  });
});
