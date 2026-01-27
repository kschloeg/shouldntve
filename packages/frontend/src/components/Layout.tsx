import React from 'react';
import { useNavigate } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import useAuth from '../hooks/useAuth';

type Props = {
  children: React.ReactNode;
};

export default function Layout({ children }: Props) {
  const navigate = useNavigate();
  const { subject, signOut, initializing } = useAuth();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {initializing && (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(255,255,255,0.8)',
            zIndex: 1300,
          }}
        >
          <CircularProgress />
        </Box>
      )}

      <AppBar position="fixed">
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setDrawerOpen(true)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Shouldntve
          </Typography>
          {subject ? (
            <>
              <Typography variant="body1">{subject}</Typography>
              <Button
                color="inherit"
                onClick={() => {
                  void signOut();
                  navigate('/login');
                }}
                sx={{ ml: 2 }}
              >
                Sign Out
              </Button>
            </>
          ) : null}
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Box
          sx={{ width: 240 }}
          role="presentation"
          onClick={() => setDrawerOpen(false)}
        >
          <List>
            <ListItem button onClick={() => navigate('/')}>
              <ListItemText primary="Users" />
            </ListItem>
            <ListItem button onClick={() => navigate('/polymarket')}>
              <ListItemText primary="Polymarket" />
            </ListItem>
            <ListItem button onClick={() => navigate('/psychic')}>
              <ListItemText primary="Psychic" />
            </ListItem>
            <ListItem button onClick={() => navigate('/login')}>
              <ListItemText primary="Login" />
            </ListItem>
          </List>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8, width: '100%' }}>
        {children}
      </Box>
    </Box>
  );
}
