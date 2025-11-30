type User = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
};

type Props = {
  users: User[];
  editingEmail: string | null;
  editFirstName: string;
  editLastName: string;
  editPhone: string;
  setEditFirstName: (v: string) => void;
  setEditLastName: (v: string) => void;
  setEditPhone: (v: string) => void;
  startEdit: (email: string) => void;
  cancelEdit: () => void;
  saveEdit: (email: string) => Promise<void>;
  savingEmail?: string | null;
  loading?: boolean;
  subject: string | null;
};

import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

export default function UsersTable({
  users,
  editingEmail,
  editFirstName,
  editLastName,
  editPhone,
  setEditFirstName,
  setEditLastName,
  setEditPhone,
  startEdit,
  cancelEdit,
  saveEdit,
  savingEmail,
  loading,
  subject,
}: Props) {
  console.log('Rendering UsersTable with users:', { users, loading, subject });
  return (
    <div>
      <TableContainer component={Paper} sx={{ mt: 2 }}>
        {loading && users.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>First Name</TableCell>
                <TableCell>Last Name</TableCell>
                <TableCell>Email Address</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map(({ email, firstName, lastName, phone }) => (
                <TableRow key={email}>
                  <TableCell>
                    {editingEmail === email ? (
                      <TextField
                        value={editFirstName}
                        onChange={(e) => setEditFirstName(e.target.value)}
                      />
                    ) : (
                      firstName
                    )}
                  </TableCell>
                  <TableCell>
                    {editingEmail === email ? (
                      <TextField
                        value={editLastName}
                        onChange={(e) => setEditLastName(e.target.value)}
                      />
                    ) : (
                      lastName
                    )}
                  </TableCell>
                  <TableCell>{email}</TableCell>
                  <TableCell>
                    {editingEmail === email ? (
                      <TextField
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                      />
                    ) : (
                      phone
                    )}
                  </TableCell>
                  <TableCell>
                    {subject === email ? (
                      editingEmail === email ? (
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            variant="contained"
                            onClick={() => void saveEdit(email)}
                            disabled={savingEmail === email}
                          >
                            {savingEmail === email ? 'Saving...' : 'Save'}
                          </Button>
                          <Button variant="outlined" onClick={cancelEdit}>
                            Cancel
                          </Button>
                        </Box>
                      ) : (
                        <Button
                          variant="outlined"
                          onClick={() => startEdit(email)}
                        >
                          Edit
                        </Button>
                      )
                    ) : (
                      <em>read-only</em>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableContainer>
    </div>
  );
}
