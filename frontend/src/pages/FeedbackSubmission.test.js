import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import UserPlatformFeedback from "./user/UserPlatformFeedback";
import RecruiterPlatformFeedback from "./admin/PlatformFeedback";

jest.mock("axios", () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

const savedFeedback = {
  _id: "feedback-123",
  rating: 5,
  feedback: "Clear and helpful experience.",
  submittedAt: "2030-01-02T03:04:05.000Z",
};

const feedbackButton = () =>
  screen.getByRole("button", { name: "Submit Feedback" });

const provideValidFeedback = () => {
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Clear and helpful experience." },
  });
};

describe("platform feedback submission", () => {
  beforeEach(() => {
    axios.get.mockImplementation((url) =>
      Promise.resolve({
        data: {
          feedback: url.startsWith("/api/user/")
            ? []
            : null,
        },
      }),
    );
    axios.post.mockResolvedValue({ data: { feedback: savedFeedback } });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("user can submit feedback without a rating through the user API", async () => {
    render(
      <MemoryRouter>
        <UserPlatformFeedback />
      </MemoryRouter>,
    );

    await screen.findByText("Your Feedback");
    expect(feedbackButton()).toBeDisabled();
    provideValidFeedback();
    expect(feedbackButton()).toBeEnabled();

    fireEvent.click(feedbackButton());

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith("/api/user/platform-feedback", {
        feedback: "Clear and helpful experience.",
      }),
    );
    expect(
      await screen.findByText("Your feedback was submitted successfully."),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  test("recruiter can submit feedback without a rating through the recruiter API", async () => {
    render(
      <MemoryRouter>
        <RecruiterPlatformFeedback />
      </MemoryRouter>,
    );

    await screen.findByText("How would you rate the Job Portal?");
    expect(feedbackButton()).toBeDisabled();
    provideValidFeedback();
    expect(feedbackButton()).toBeEnabled();

    fireEvent.click(feedbackButton());

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        "/api/recruiter/platform-feedback",
        {
          feedback: "Clear and helpful experience.",
        },
      ),
    );
    expect(
      await screen.findByText("Thank you for your feedback"),
    ).toBeInTheDocument();
  });

  test.each([
    ["user", UserPlatformFeedback],
    ["recruiter", RecruiterPlatformFeedback],
  ])("%s cannot submit blank feedback", async (_role, Page) => {
    render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>,
    );

    await screen.findByText("How would you rate the Job Portal?");
    const feedbackInput = screen.getByRole("textbox");
    fireEvent.change(feedbackInput, {
      target: { value: "A valid comment." },
    });
    expect(feedbackButton()).toBeEnabled();
    fireEvent.change(feedbackInput, { target: { value: "   " } });
    expect(feedbackButton()).toBeDisabled();
    fireEvent.submit(feedbackInput.closest("form"));

    expect(
      await screen.findByText(
        "Enter feedback between 1 and 2000 characters.",
      ),
    ).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });

  test.each([
    ["user", UserPlatformFeedback, "/api/user/platform-feedback"],
    ["recruiter", RecruiterPlatformFeedback, "/api/recruiter/platform-feedback"],
  ])("%s sees an error when feedback submission fails", async (_role, Page, endpoint) => {
    axios.post.mockRejectedValue({
      response: { data: { error: "Feedback could not be saved." } },
    });
    render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>,
    );

    await screen.findByText("How would you rate the Job Portal?");
    provideValidFeedback();
    fireEvent.click(feedbackButton());

    expect(await screen.findByText("Feedback could not be saved.")).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledWith(endpoint, {
      feedback: "Clear and helpful experience.",
    });
  });

  test.each([
    ["user", UserPlatformFeedback, "/api/user/platform-feedback"],
    ["recruiter", RecruiterPlatformFeedback, "/api/recruiter/platform-feedback"],
  ])("%s prevents duplicate clicks while feedback is saving", async (_role, Page, endpoint) => {
    let finishRequest;
    axios.post.mockReturnValue(
      new Promise((resolve) => {
        finishRequest = resolve;
      }),
    );
    render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>,
    );

    await screen.findByText("How would you rate the Job Portal?");
    provideValidFeedback();
    const form = screen.getByRole("textbox").closest("form");
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(endpoint, {
      feedback: "Clear and helpful experience.",
    });
    await act(async () => {
      finishRequest({ data: { feedback: savedFeedback } });
    });
    if (_role === "recruiter") {
      expect(await screen.findByText("Thank you for your feedback")).toBeInTheDocument();
    }
  });

  test.each([
    ["user", UserPlatformFeedback, "/api/user/platform-feedback"],
    ["recruiter", RecruiterPlatformFeedback, "/api/recruiter/platform-feedback"],
  ])("%s still saves a selected rating", async (_role, Page, endpoint) => {
    render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>,
    );

    await screen.findByText("How would you rate the Job Portal?");
    provideValidFeedback();
    fireEvent.click(screen.getByRole("radio", { name: "5 Stars" }));
    fireEvent.click(feedbackButton());

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(endpoint, {
        feedback: "Clear and helpful experience.",
        rating: 5,
      }),
    );
  });
});
