import React from "react";
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import AudioManager from "../../components/Apps/AudioManager/AudioManager";

const AudioManagement = () => {
  return (
    <Container maxWidth="md" style={{ marginTop: 24 }}>
      <Box>
        <Typography variant="h4" gutterBottom>
          Audio Management
        </Typography>

        <AudioManager />
      </Box>
    </Container>
  );
};

export default AudioManagement;
