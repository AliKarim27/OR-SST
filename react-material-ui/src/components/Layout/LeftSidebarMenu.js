import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Box, Typography } from "@mui/material";

const LeftSidebarMenu = ({ toggleActive }) => {
  const location = useLocation();

  const isActiveLink = (path) => (location.pathname === path ? "active" : "");

  return (
    <Box className="leftSidebarDark hide-for-horizontal-nav">
      <Box className="left-sidebar-menu">
        <Box className="logo">
          <Link to="/apps/audio-management">
            <img
              src="/images/logo-icon.svg"
              alt="logo-icon"
              width={26}
              height={26}
            />
            <Typography component={"span"}>OR Central</Typography>
          </Link>
        </Box>

        <Box className="burger-menu" onClick={toggleActive}>
          <Typography component={"span"} className="top-bar"></Typography>
          <Typography component={"span"} className="middle-bar"></Typography>
          <Typography component={"span"} className="bottom-bar"></Typography>
        </Box>

        <Box className="sidebar-inner">
          <Box className="sidebar-menu">
            <Link
              to="/apps/audio-management"
              className={`sidebar-menu-link ${isActiveLink(
                "/apps/audio-management"
              )}`}
            >
              <i className="material-symbols-outlined">mic</i>
              <Typography component={"span"} className="title">
                Audio Management
              </Typography>
            </Link>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default LeftSidebarMenu;
