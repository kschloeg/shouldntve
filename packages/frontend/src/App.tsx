import { Routes, Route } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import MainPage from './components/MainPage';
import PolymarketPage from './components/PolymarketPage';
import PsychicPage from './components/PsychicPage';
import SnackbarProvider from './components/SnackbarProvider';

function App() {
  return (
    <SnackbarProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<MainPage />} />
        <Route path="/polymarket" element={<PolymarketPage />} />
        <Route path="/psychic" element={<PsychicPage />} />
        <Route path="/psychic/:predictionId" element={<PsychicPage />} />
      </Routes>
    </SnackbarProvider>
  );
}

export default App;
