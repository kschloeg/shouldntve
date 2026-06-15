import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import charbelImg from '../assets/charbel.jpg';

export default function SupportPage() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 6,
        px: 2,
        background:
          'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      }}
    >
      <Typography
        variant="h1"
        sx={{
          fontWeight: 900,
          fontSize: { xs: '3rem', sm: '5rem', md: '7rem' },
          color: '#FFD700',
          textShadow: '0 0 20px #ff6600, 0 0 40px #ff6600, 4px 4px 0 #cc0000',
          letterSpacing: '0.05em',
          mb: 4,
          textAlign: 'center',
        }}
      >
        April Fools!
      </Typography>

      <Box
        sx={{
          width: '100%',
          maxWidth: 800,
          aspectRatio: '16/9',
          borderRadius: 3,
          overflow: 'hidden',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          mb: 5,
        }}
      >
        <iframe
          width="100%"
          height="100%"
          src="https://www.youtube.com/embed/xvFZjo5PgG0?autoplay=1&mute=1"
          title="Rick Astley - Never Gonna Give You Up"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ display: 'block' }}
        />
      </Box>

      <Box
        component="img"
        src={charbelImg}
        alt="Happy Holidays Charbel"
        sx={{
          maxWidth: { xs: '100%', sm: 600 },
          width: '100%',
          borderRadius: 3,
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        }}
      />
    </Box>
  );
}
