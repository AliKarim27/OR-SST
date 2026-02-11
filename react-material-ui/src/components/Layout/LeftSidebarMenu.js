import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Box, Typography } from "@mui/material";

const LeftSidebarMenu = ({ toggleActive }) => {
  const location = useLocation();
  const [sttMenuOpen, setSttMenuOpen] = useState(true);
  const [nerMenuOpen, setNerMenuOpen] = useState(true);

  const isActiveLink = (path) => (location.pathname === path ? "active" : "");
  
  const isSTTActive = () => {
    return location.pathname === "/apps/stt-model-settings" || 
           location.pathname === "/apps/stt-tester";
  };

  const isNERActive = () => {
    return location.pathname === "/apps/ner-overview" ||
           location.pathname === "/apps/ner-model-management" ||
           location.pathname === "/apps/ner-training" ||
           location.pathname === "/apps/ner-data-management" ||
           location.pathname === "/apps/ner-entity-types" ||
           location.pathname === "/apps/ner-tester";
  };

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

            <Box
              className={`sidebar-menu-link ${isSTTActive() ? "active" : ""}`}
              onClick={() => setSttMenuOpen(!sttMenuOpen)}
              sx={{ cursor: 'pointer' }}
            >
              <i className="material-symbols-outlined">text_to_speech</i>
              <Typography component={"span"} className="title">
                STT
              </Typography>
              <i className="material-symbols-outlined" style={{ marginLeft: 'auto', fontSize: '18px' }}>
                {sttMenuOpen ? 'expand_less' : 'expand_more'}
              </i>
            </Box>

            {sttMenuOpen && (
              <Box sx={{ pl: 2 }}>
                <Link
                  to="/apps/stt-model-settings"
                  className={`sidebar-menu-link ${isActiveLink(
                    "/apps/stt-model-settings"
                  )}`}
                >
                  <i className="material-symbols-outlined">settings</i>
                  <Typography component={"span"} className="title">
                    Model Settings
                  </Typography>
                </Link>

                <Link
                  to="/apps/stt-tester"
                  className={`sidebar-menu-link ${isActiveLink(
                    "/apps/stt-tester"
                  )}`}
                >
                  <i className="material-symbols-outlined">transcribe</i>
                  <Typography component={"span"} className="title">
                    Tester
                  </Typography>
                </Link>
              </Box>
            )}

            <Box
              className={`sidebar-menu-link ${isNERActive() ? "active" : ""}`}
              onClick={() => setNerMenuOpen(!nerMenuOpen)}
              sx={{ cursor: 'pointer' }}
            >
              <i className="material-symbols-outlined">psychology</i>
              <Typography component={"span"} className="title">
                NER
              </Typography>
              <i className="material-symbols-outlined" style={{ marginLeft: 'auto', fontSize: '18px' }}>
                {nerMenuOpen ? 'expand_less' : 'expand_more'}
              </i>
            </Box>

            {nerMenuOpen && (
              <Box sx={{ pl: 2 }}>
                <Link
                  to="/apps/ner-overview"
                  className={`sidebar-menu-link ${isActiveLink(
                    "/apps/ner-overview"
                  )}`}
                >
                  <i className="material-symbols-outlined">dashboard</i>
                  <Typography component={"span"} className="title">
                    Overview
                  </Typography>
                </Link>

                <Link
                  to="/apps/ner-model-management"
                  className={`sidebar-menu-link ${isActiveLink(
                    "/apps/ner-model-management"
                  )}`}
                >
                  <i className="material-symbols-outlined">storage</i>
                  <Typography component={"span"} className="title">
                    Model Management
                  </Typography>
                </Link>

                <Link
                  to="/apps/ner-training"
                  className={`sidebar-menu-link ${isActiveLink(
                    "/apps/ner-training"
                  )}`}
                >
                  <i className="material-symbols-outlined">school</i>
                  <Typography component={"span"} className="title">
                    Training
                  </Typography>
                </Link>

                <Link
                  to="/apps/ner-data-management"
                  className={`sidebar-menu-link ${isActiveLink(
                    "/apps/ner-data-management"
                  )}`}
                >
                  <i className="material-symbols-outlined">dataset</i>
                  <Typography component={"span"} className="title">
                    Training Data
                  </Typography>
                </Link>

                <Link
                  to="/apps/ner-entity-types"
                  className={`sidebar-menu-link ${isActiveLink(
                    "/apps/ner-entity-types"
                  )}`}
                >
                  <i className="material-symbols-outlined">label</i>
                  <Typography component={"span"} className="title">
                    Entity Types
                  </Typography>
                </Link>

                <Link
                  to="/apps/ner-tester"
                  className={`sidebar-menu-link ${isActiveLink(
                    "/apps/ner-tester"
                  )}`}
                >
                  <i className="material-symbols-outlined">science</i>
                  <Typography component={"span"} className="title">
                    Tester
                  </Typography>
                </Link>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default LeftSidebarMenu;
