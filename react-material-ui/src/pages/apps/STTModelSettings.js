import React from "react";
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import STTModelSettings from "../../components/Apps/STTModelSettings/STTModelSettings";

const STTModelSettingsPage = () => {
  return (
    <Container maxWidth="lg" style={{ marginTop: 24, marginBottom: 40 }}>
      <Box>
        <STTModelSettings />
      </Box>
    </Container>
  );
};

export default STTModelSettingsPage;
