import React, { useEffect } from 'react';
import { apiFetch } from '../utils/apiClient';
import UsersTable from './UsersTable';
import Box from '@mui/material/Box';
// removed unused imports
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import Layout from './Layout';
import useAuth from '../hooks/useAuth';
import { useSnackbar } from './snackbarContext';

type User = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
};

export default function MainPage() {
  const [users, setUsers] = React.useState<User[]>([]);
  // create user form removed; users are managed from backend
  const [savingEmail, setSavingEmail] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [editingEmail, setEditingEmail] = React.useState<string | null>(null);
  const [editFirstName, setEditFirstName] = React.useState('');
  const [editLastName, setEditLastName] = React.useState('');
  const [editPhone, setEditPhone] = React.useState('');
  const [triggeringSports, setTriggeringSports] = React.useState(false);
  const { subject } = useAuth();
  const showSnackbar = useSnackbar();

  console.log('Rendering MainPage with users:', { users, loading, subject });
  const syncUsers = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${import.meta.env.VITE_API_URL}/users`);
      const body = await res.json();
      setUsers(body || []);
    } catch (e) {
      console.error('syncUsers error', e);
      showSnackbar?.('Failed to load users', 'error');
    }
    setLoading(false);
  }, [showSnackbar]);

  useEffect(() => {
    void syncUsers();
  }, [syncUsers]);

  // create handler removed

  const startEdit = (email: string) => {
    const row = users.find((u) => u.email === email);
    if (!row) return;
    setEditingEmail(email);
    setEditFirstName(row.firstName);
    setEditLastName(row.lastName);
    setEditPhone(row.phone || '');
  };

  const cancelEdit = () => {
    setEditingEmail(null);
  };

  const saveEdit = async (emailArg: string) => {
    try {
      setSavingEmail(emailArg);
      const body: Partial<User> & { email: string } = { email: emailArg };
      if (editFirstName) body.firstName = editFirstName;
      if (editLastName) body.lastName = editLastName;
      if (editPhone) body.phone = editPhone;
      const res = await apiFetch(`${import.meta.env.VITE_API_URL}/users`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        showSnackbar?.('Update failed', 'error');
        setSavingEmail(null);
        return;
      }
      setEditingEmail(null);
      setSavingEmail(null);
      await syncUsers();
      showSnackbar?.('Updated', 'success');
    } catch (e) {
      console.error('saveEdit error', e);
      setSavingEmail(null);
      showSnackbar?.('Network error', 'error');
    }
  };

  const triggerSportsScores = async () => {
    setTriggeringSports(true);
    try {
      const res = await apiFetch(
        `${import.meta.env.VITE_API_URL}/sports/trigger`,
        {
          method: 'POST',
        }
      );
      if (!res.ok) {
        showSnackbar?.('Failed to trigger sports scores', 'error');
        setTriggeringSports(false);
        return;
      }
      showSnackbar?.(
        'Sports scores email triggered! Check your inbox.',
        'success'
      );
    } catch (e) {
      console.error('triggerSportsScores error', e);
      showSnackbar?.('Network error', 'error');
    }
    setTriggeringSports(false);
  };

  return (
    <Layout>
      <Box>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Typography variant="h4">Users</Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={triggerSportsScores}
            disabled={triggeringSports}
          >
            {triggeringSports ? 'Sending...' : 'Send MN Sports Scores'}
          </Button>
        </Box>
        {loading || !subject ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        ) : null}

        <UsersTable
          users={users}
          editingEmail={editingEmail}
          editFirstName={editFirstName}
          editLastName={editLastName}
          editPhone={editPhone}
          setEditFirstName={setEditFirstName}
          setEditLastName={setEditLastName}
          setEditPhone={setEditPhone}
          startEdit={startEdit}
          cancelEdit={cancelEdit}
          saveEdit={saveEdit}
          savingEmail={savingEmail}
          subject={subject}
        />
      </Box>
    </Layout>
  );
}
