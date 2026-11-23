import { Box, Button } from "@mui/material";
import React from "react";
import SidebarAdm from "./Sidebar";
import HeaderTop from "./HeaderTop";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";

const DashboardLayout = ({ Component, ...props }) => {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        display: "flex",
        width: "100%",
        height: "100vh",
        "@supports (height: 100dvh)": { height: "100dvh" },
        overflow: "hidden",
      }}
    >
      <SidebarAdm />
      <Box
        sx={{
          display: "flex",
          flex: "1 1 0%",
          flexDirection: "column",
          height: "100%",
          minWidth: 0,
          minHeight: 0,
          bgcolor: "LightGray",
        }}
      >
        <Box sx={{ flexShrink: 0 }}>
          <HeaderTop />
        </Box>
        <Box
          sx={{
            flex: "1 1 0%",
            minWidth: 0,
            minHeight: 0,
            overflowX: "hidden",
            overflowY: "auto",
            overscrollBehaviorY: "contain",
            p: { xs: 1.5, sm: 3 },
          }}
        >
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/")}
            sx={{ mb: 2 }}
          >
            Back
          </Button>
          <Component {...props} />
        </Box>
      </Box>
    </Box>
  );
};

const Layout = (Component) => (props) => (
  <DashboardLayout Component={Component} {...props} />
);

export default Layout;
