// App.jsx
import * as React from 'react';
import { createTheme, ThemeProvider, styled, keyframes } from '@mui/material/styles';
import { Box, Stack, Tooltip, IconButton } from '@mui/material';
import CameraAltRounded from '@mui/icons-material/CameraAltRounded';
import VideocamRounded from '@mui/icons-material/VideocamRounded';
import StopRounded from '@mui/icons-material/StopRounded';

const theme = createTheme({
  palette: {
    primary: { main: '#5514db' },     // Custom purple
    secondary: { main: '#4e08d8' }    // Custom purple hover
  },
  shape: { borderRadius: 14 },
  typography: { button: { textTransform: 'none', fontWeight: 600 } }
});

const ShutterButton = styled(IconButton)(({ theme }) => ({
  width: 88,
  height: 88,
  borderRadius: '50%',
  color: '#fff',
  background:
    'radial-gradient(65% 65% at 50% 50%, #4e08d8 0%, #5514db 60%, #4a10c4 100%)',
  boxShadow:
    '0 10px 30px rgba(85,20,219,.45), inset 0 2px 4px rgba(255,255,255,.2)',
  transition: 'transform .08s ease, box-shadow .2s ease, filter .2s ease',
  '&:hover': {
    transform: 'translateY(-1px)',
    boxShadow:
      '0 14px 40px rgba(85,20,219,.55), inset 0 2px 6px rgba(255,255,255,.25)'
  },
  '&:active': { transform: 'translateY(0)', filter: 'brightness(.95)' },
  '&:focus-visible': { outline: '3px solid rgba(167,139,250,.6)', outlineOffset: 2 }
}));

const pulse = keyframes`
  0%   { box-shadow: 0 0 0 0 rgba(85,20,219,.60); }
  70%  { box-shadow: 0 0 0 16px rgba(85,20,219,0); }
  100% { box-shadow: 0 0 0 0 rgba(85,20,219,0); }
`;

const RecordButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== 'recording'
})(({ theme, recording }) => ({
  width: 72,
  height: 72,
  borderRadius: '50%',
  color: '#fff',
  background: 'linear-gradient(135deg, #4e08d8 0%, #5514db 70%)',
  boxShadow: '0 10px 24px rgba(85,20,219,.35)',
  transition: 'transform .08s ease, filter .2s ease, box-shadow .2s ease',
  '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 14px 36px rgba(85,20,219,.45)' },
  '&:active': { transform: 'translateY(0)', filter: 'brightness(.95)' },
  '&:focus-visible': { outline: '3px solid rgba(167,139,250,.6)', outlineOffset: 2 },
  ...(recording && {
    animation: `${pulse} 1.5s ease-in-out infinite`,
    background: 'linear-gradient(135deg, #5514db 0%, #4a10c4 70%)'
  })
}));

export default function TestUICamera() {
  const [recording, setRecording] = React.useState(false);

  const handlePhoto = () => {
    // Вызови свою логику фото: например, onCapturePhoto()
    console.log('capture-photo');
  };

  const handleRecordToggle = () => {
    // Вызови свою логику старта/стопа записи
    setRecording((v) => !v);
    console.log('toggle-video', !recording ? 'start' : 'stop');
  };

  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          minHeight: '100dvh',
          bgcolor: '#0b0b12',
          display: 'grid',
          placeItems: 'center',
          p: 3
        }}
      >
        <Stack direction="row" spacing={3} alignItems="center">
          <Tooltip title="Сделать фото" enterDelay={200}>
            <ShutterButton aria-label="Сделать фото" onClick={handlePhoto}>
              <CameraAltRounded fontSize="large" />
            </ShutterButton>
          </Tooltip>

          <Tooltip title={recording ? 'Остановить запись' : 'Начать запись'} enterDelay={200}>
            <RecordButton
              aria-label={recording ? 'Остановить запись' : 'Начать запись'}
              aria-pressed={recording}
              onClick={handleRecordToggle}
              recording={recording ? 1 : 0}
            >
              {recording ? <StopRounded fontSize="large" /> : <VideocamRounded fontSize="large" />}
            </RecordButton>
          </Tooltip>
        </Stack>
      </Box>
    </ThemeProvider>
  );
}
