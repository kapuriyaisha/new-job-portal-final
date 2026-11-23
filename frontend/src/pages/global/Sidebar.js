import React from "react";
import {
  Sidebar,
  Menu,
  MenuItem,
  menuClasses,
  useProSidebar,
} from "react-pro-sidebar";
import DashboardIcon from "@mui/icons-material/Dashboard";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import { Box, useTheme } from "@mui/material";
import WorkIcon from "@mui/icons-material/Work";
import CategoryIcon from "@mui/icons-material/Category";
import WorkHistoryIcon from "@mui/icons-material/WorkHistory";
import Person3Icon from "@mui/icons-material/Person3";
import FeedbackIcon from "@mui/icons-material/Feedback";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AssignmentIcon from "@mui/icons-material/Assignment";
import FlagIcon from "@mui/icons-material/Flag";
import RateReviewIcon from "@mui/icons-material/RateReview";
import EventNoteIcon from "@mui/icons-material/EventNote";
import EmailIcon from "@mui/icons-material/Email";
import Avatar from "@mui/material/Avatar";
import logoDashboard from "../../images/hr-project.png";
import { Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

const SidebarAdm = () => {
  const { userInfo } = useSelector((state) => state.signIn);
  const { palette } = useTheme();
  const { collapsed } = useProSidebar();
  const location = useLocation();
  const isRecruiter =
    Number(userInfo?.role?.role ?? userInfo?.role ?? 0) === 1;

  return (
    <>
      <Sidebar
        backgroundColor="white"
        breakPoint="md"
        style={{ borderRightStyle: "none" }}
        rootStyles={{
          "& > .ps-sidebar-container": { overflowY: "hidden" },
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            minHeight: 0,
          }}
        >
          <Box
            sx={{
              pt: 3,
              pb: 5,
              display: "flex",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {collapsed ? (
              <Avatar alt="logo dashboard" src={logoDashboard} />
            ) : (
              <Box sx={{ display: "flex", justifyContent: "center" }}>
                <img
                  style={{
                    width: "100px",
                    heigth: "100px",
                    textAlign: "center",
                    transition: "all ease-out .5s",
                  }}
                  src={logoDashboard}
                  alt="logo dashboard"
                />
              </Box>
            )}
          </Box>
          <Box
            sx={{
              flex: "1 1 0%",
              minHeight: 0,
              overflowY: "auto",
              overscrollBehaviorY: "contain",
              WebkitOverflowScrolling: "touch",
              ...(isRecruiter &&
                !collapsed && {
                  overflowX: "auto",
                  "& .ps-menu-root, & .ps-menuitem-root, & .ps-menu-button": {
                    width: "max-content",
                    minWidth: "100%",
                  },
                  "& .ps-menu-label": {
                    flexGrow: 0,
                    width: "max-content",
                    overflow: "visible",
                    textOverflow: "clip",
                    whiteSpace: "nowrap",
                  },
                }),
            }}
          >
            <Menu
              menuItemStyles={{
                button: {
                  [`&.${menuClasses.button}`]: {
                    color: "#fafafa",
                  },
                  [`&.${menuClasses.disabled}`]: {
                    color: "green",
                  },
                  "&:hover": {
                    backgroundColor: "",
                    color: "#fafafa",
                  },
                },

                icon: {
                  [`&.${menuClasses.icon}`]: {
                    color: palette.primary.main,
                  },
                },
              }}
            >
              {userInfo &&
                Number(userInfo?.role?.role ?? userInfo?.role ?? 0) === 1 && (
                  <>
                    <MenuItem
                      component={<Link to="/recruiter/dashboard" />}
                      icon={<DashboardIcon />}
                    >
                      <div style={{ color: "black" }}> Dashboard </div>
                    </MenuItem>
                    <MenuItem
                      component={<Link to="/recruiter/jobs" />}
                      icon={<WorkIcon />}
                    >
                      <div style={{ color: "black" }}> Jobs </div>
                    </MenuItem>
                    <MenuItem
                      component={<Link to="/recruiter/category" />}
                      icon={<CategoryIcon />}
                    >
                      <div style={{ color: "black" }}> Category </div>{" "}
                    </MenuItem>{" "}
                    <MenuItem
                      component={<Link to="/recruiter/users" />}
                      icon={<GroupAddIcon />}
                    >
                      <div style={{ color: "black" }}>
                        {" "}
                        Received Applications{" "}
                      </div>
                    </MenuItem>
                    <MenuItem
                      component={<Link to="/recruiter/interviews" />}
                      icon={<EventNoteIcon />}
                      active={location.pathname === "/recruiter/interviews"}
                    >
                      <div style={{ color: "black" }}> Interviews </div>
                    </MenuItem>
                    <MenuItem
                      component={<Link to="/recruiter/email-generator" />}
                      icon={<EmailIcon />}
                      active={location.pathname === "/recruiter/email-generator"}
                    >
                      <div style={{ color: "black" }}> Recruitment Email Generator </div>
                    </MenuItem>
                    <MenuItem
                      component={<Link to="/recruiter/suitable-candidates" />}
                      icon={<WorkHistoryIcon />}
                    >
                      <div style={{ color: "black" }}>
                        {" "}
                        Suitable Candidates{" "}
                      </div>
                    </MenuItem>
                    <MenuItem
                      component={<Link to="/recruiter/chat" />}
                      icon={<Person3Icon />}
                    >
                      <div style={{ color: "black" }}>Chat </div>
                    </MenuItem>
                    <MenuItem
                      component={<Link to="/recruiter/platform-feedback" />}
                      icon={<FeedbackIcon />}
                    >
                      <div style={{ color: "black" }}> Platform Feedback </div>
                    </MenuItem>
                    <MenuItem
                      component={<Link to="/recruiter/info" />}
                      icon={<Person3Icon />}
                    >
                      <div style={{ color: "black" }}> Personal Info </div>
                    </MenuItem>
                  </>
                )}
              {userInfo &&
                Number(userInfo?.role?.role ?? userInfo?.role ?? 0) === 0 && (
                  <>
                    <MenuItem
                      component={<Link to="/user/dashboard" />}
                      icon={<DashboardIcon />}
                    >
                      <div style={{ color: "black" }}> Dashboard </div>
                    </MenuItem>
                    <MenuItem
                      component={<Link to="/user/complete-profile" />}
                      icon={<Person3Icon />}
                    >
                      <div style={{ color: "black" }}> Complete Profile </div>
                    </MenuItem>
                    <MenuItem
                      component={<Link to="/user/resume-recommendations" />}
                      icon={<AutoAwesomeIcon />}
                    >
                      <div style={{ color: "black" }}> AI Job Match </div>
                    </MenuItem>
                    <MenuItem
                      component={<Link to="/user/saved-jobs" />}
                      icon={<WorkHistoryIcon />}
                    >
                      <div style={{ color: "black" }}> Saved Jobs </div>
                    </MenuItem>
                    <MenuItem
                      component={<Link to="/user/jobs" />}
                      icon={<WorkHistoryIcon />}
                    >
                      <div style={{ color: "black" }}> Track Applications </div>
                    </MenuItem>
                    <MenuItem
                      component={<Link to="/user/feedback" />}
                      icon={<FeedbackIcon />}
                    >
                      <div style={{ color: "black" }}> Feedback </div>
                    </MenuItem>
                    <MenuItem
                      component={<Link to="/user/chat" />}
                      icon={<Person3Icon />}
                    >
                      <div style={{ color: "black" }}> Chat </div>
                    </MenuItem>
                    <MenuItem
                      component={<Link to="/user/info" />}
                      icon={<Person3Icon />}
                    >
                      <div style={{ color: "black" }}> Personal Info </div>
                    </MenuItem>
                    <MenuItem
                      component={<Link to="/my-applications" />}
                      icon={<AssignmentIcon />}
                      active={location.pathname === "/my-applications"}
                      rootStyles={{
                        [`& .${menuClasses.button}`]: {
                          opacity: 1,
                          visibility: "visible",
                          "&:hover, &:focus-visible": {
                            backgroundColor: "#E3F2FD",
                            opacity: 1,
                            visibility: "visible",
                          },
                          [`&.${menuClasses.active}`]: {
                            backgroundColor: "#E3F2FD",
                            opacity: 1,
                            visibility: "visible",
                          },
                        },
                        [`& .${menuClasses.icon}`]: {
                          color: "#2196F3",
                          opacity: 1,
                          visibility: "visible",
                        },
                      }}
                    >
                      <div style={{ color: "black" }}> My Applications </div>
                    </MenuItem>
                  </>
                )}
              {userInfo &&
                Number(userInfo?.role?.role ?? userInfo?.role ?? 0) === 2 && (
                  <>
                    <MenuItem
                      component={<Link to="/mainadmin/stats" />}
                      icon={<DashboardIcon />}
                    >
                      <div style={{ color: "black" }}> Dashboard </div>
                    </MenuItem>
                    <MenuItem
                      component={<Link to="/mainadmin" />}
                      icon={<Person3Icon />}
                    >
                      <div style={{ color: "black" }}> All Users </div>
                    </MenuItem>
                    <MenuItem
                      component={<Link to="/mainadmin/recruiters" />}
                      icon={<GroupAddIcon />}
                    >
                      <div style={{ color: "black" }}> Recruiters </div>
                    </MenuItem>
                    <MenuItem
                      component={<Link to="/mainadmin/alljobs" />}
                      icon={<WorkHistoryIcon />}
                    >
                      <div style={{ color: "black" }}> All Jobs </div>
                    </MenuItem>
                    <MenuItem
                      component={<Link to="/mainadmin/allcategory" />}
                      icon={<CategoryIcon />}
                    >
                      <div style={{ color: "black" }}> All Categories </div>
                    </MenuItem>
                    <MenuItem
                      component={<Link to="/mainadmin/applications" />}
                      icon={<AssignmentIcon />}
                    >
                      <div style={{ color: "black" }}> Monitor Applications </div>
                    </MenuItem>
                    <MenuItem
                      component={<Link to="/mainadmin/reports" />}
                      icon={<FlagIcon />}
                    >
                      <div style={{ color: "black" }}> Reported Content </div>
                    </MenuItem>
                    <MenuItem
                      component={<Link to="/mainadmin/feedback" />}
                      icon={<RateReviewIcon />}
                    >
                      <div style={{ color: "black" }}> Feedback </div>
                    </MenuItem>
                    <MenuItem
                      component={<Link to="/mainadmin/info" />}
                      icon={<Person3Icon />}
                    >
                      <div style={{ color: "black" }}> Personal Info </div>
                    </MenuItem>
                  </>
                )}
            </Menu>
          </Box>
        </Box>
      </Sidebar>
    </>
  );
};

export default SidebarAdm;
