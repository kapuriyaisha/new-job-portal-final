import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import RecruiterEmailGenerator from "./RecruiterEmailGenerator";

jest.mock("axios");

describe("RecruiterEmailGenerator", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({
      data: {
        applications: [
          {
            _id: "application-1",
            applicantName: "Avery Candidate",
            applicantEmail: "avery@example.com",
            jobTitle: "Software Engineer",
            jobCompany: "Example Company",
          },
        ],
      },
    });
    axios.post.mockResolvedValue({
      data: {
        success: true,
        subject: "Interview invitation",
        body: "Hello Avery, we would like to meet you.",
      },
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue() },
    });
    jest.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("generates, copies, edits, and confirms sending a candidate email", async () => {
    render(<RecruiterEmailGenerator />);

    const candidateSelect = await screen.findByRole("combobox", {
      name: /candidate application/i,
    });
    fireEvent.mouseDown(candidateSelect);
    fireEvent.click(
      await screen.findByRole("option", {
        name: /Avery Candidate.*Software Engineer/,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: /generate email/i }));
    const subjectField = await screen.findByLabelText("Subject");
    const bodyField = screen.getByLabelText("Email body");

    expect(axios.post).toHaveBeenNthCalledWith(
      1,
      "/api/recruiter/email-generator/generate",
      {
        applicationId: "application-1",
        emailType: "interview_invitation",
        tone: "professional",
      },
    );

    fireEvent.change(subjectField, { target: { value: "Updated subject" } });
    fireEvent.change(bodyField, { target: { value: "Updated email body" } });
    fireEvent.click(screen.getByRole("button", { name: /copy email/i }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "Subject: Updated subject\n\nUpdated email body",
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: /send email/i }));
    expect(window.confirm).toHaveBeenCalledWith(
      "Send this email to Avery Candidate (avery@example.com)?",
    );
    await waitFor(() =>
      expect(axios.post).toHaveBeenLastCalledWith(
        "/api/recruiter/email-generator/send",
        {
          applicationId: "application-1",
          emailType: "interview_invitation",
          tone: "professional",
          subject: "Updated subject",
          body: "Updated email body",
        },
      ),
    );
    expect(await screen.findByText(/Email sent to Avery Candidate/)).toBeInTheDocument();
  });
});
