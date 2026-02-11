import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LeftSidebarMenu from "./components/Layout/LeftSidebarMenu";
import Footer from "./components/Layout/Footer";
import TopNavbar from "./components/Layout/TopNavbar"; 
import ScrollToTop from "./components/Layout/ScrollToTop";

// Audio Management
import AudioManagement from "./pages/apps/AudioManagement";
import STTModelSettingsPage from "./pages/apps/STTModelSettings";
import STTTesterPage from "./pages/apps/STTTester";

// NER Management
import NEROverview from "./pages/apps/NEROverview";
import NERModelManagement from "./pages/apps/NERModelManagement";
import NERTraining from "./pages/apps/NERTraining";
import NERDataManagement from "./pages/apps/NERDataManagement";
import NERTesterPage from "./pages/apps/NERTester";
import EntityTypesPage from "./pages/apps/EntityTypes";

// Workflow
import Workflow from "./components/Apps/Workflow/Workflow";

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
              {/* Workflow */}
              <Route path="/apps/workflow" element={<Workflow />} />
              
              {/* Audio Management */}
              <Route path="/apps/audio-management" element={<AudioManagement />} />
              
              {/* STT Model Settings */}
              <Route path="/apps/stt-model-settings" element={<STTModelSettingsPage />} />
              
              {/* STT Tester */}
              <Route path="/apps/stt-tester" element={<STTTesterPage />} />
              
              {/* NER Management */}
              <Route path="/apps/ner-overview" element={<NEROverview />} />
              <Route path="/apps/ner-model-management" element={<NERModelManagement />} />
              <Route path="/apps/ner-training" element={<NERTraining />} />
              <Route path="/apps/ner-data-management" element={<NERDataManagement />} />
              <Route path="/apps/ner-entity-types" element={<EntityTypesPage />} />
              <Route path="/apps/ner-tester" element={<NERTesterPage />} />
              
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
