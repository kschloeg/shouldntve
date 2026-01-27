import { Routes, Route } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import MainPage from './components/MainPage';
import PolymarketPage from './components/PolymarketPage';
import PsychicPage from './components/PsychicPage';
import PsychicEditPage from './components/PsychicEditPage';
import SnackbarProvider from './components/SnackbarProvider';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <SnackbarProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><MainPage /></ProtectedRoute>} />
        <Route path="/polymarket" element={<ProtectedRoute><PolymarketPage /></ProtectedRoute>} />
        <Route path="/psychic" element={<ProtectedRoute><PsychicPage /></ProtectedRoute>} />
        <Route path="/psychic/:predictionId" element={<ProtectedRoute><PsychicPage /></ProtectedRoute>} />
        <Route path="/psychic/:predictionId/edit" element={<ProtectedRoute><PsychicEditPage /></ProtectedRoute>} />
      </Routes>
    </SnackbarProvider>
  );
}

export default App;
