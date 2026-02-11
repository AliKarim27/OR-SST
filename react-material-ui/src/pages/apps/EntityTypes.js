import React from "react";
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import EntityTypes from "../../components/Apps/EntityTypes/EntityTypes";

const EntityTypesPage = () => {
  return (
    <Container maxWidth="lg" style={{ marginTop: 24, marginBottom: 40 }}>
      <Box>
        <EntityTypes />
      </Box>
    </Container>
  );
};

export default EntityTypesPage;
