import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LeftSidebarMenu from "./components/Layout/LeftSidebarMenu";
import Footer from "./components/Layout/Footer";
import TopNavbar from "./components/Layout/TopNavbar"; 
import ScrollToTop from "./components/Layout/ScrollToTop";

// Audio Management
import AudioManagement from "./pages/apps/AudioManagement";
import STTModelSettingsPage from "./pages/apps/STTModelSettings";
import BlankPage from "./pages/BlankPage";

const App = () => {
  const [active, setActive] = useState(false);
  const [pathname, setPathname] = useState("");

  useEffect(() => {
    setPathname(window.location.pathname); // Get the current path
  }, []);

  const toggleActive = () => {
    setActive(!active);
  };

  const isAuthPage = [
    "/",
    "/blank-page/",
  ].includes(pathname);

  return (
    <>
      <div className={`main-wrapper-content ${active ? "active" : ""}`}>
        <Router>
          {!isAuthPage && (
            <>
              <TopNavbar toggleActive={toggleActive} />

              <LeftSidebarMenu toggleActive={toggleActive} />
            </>
          )}

          <div className="main-content">
            <ScrollToTop />

            <Routes>
              {/* Audio Management */}
              <Route path="/apps/audio-management" element={<AudioManagement />} />
              
              {/* STT Model Settings */}
              <Route path="/apps/stt-model-settings" element={<STTModelSettingsPage />} />
              
              {/* Home/Default */}
              <Route path="/" element={<BlankPage />} />
              
              {/* Fallback */}
              <Route path="*" element={<BlankPage />} />
            </Routes>
          </div>
        </Router>
      </div> 
    </>
  );
};

export default App;
