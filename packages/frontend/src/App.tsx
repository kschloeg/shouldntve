import { Routes, Route } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import MainPage from './components/MainPage';
import SnackbarProvider from './components/SnackbarProvider';

function App() {
  return (
    <SnackbarProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<MainPage />} />
      </Routes>
    </SnackbarProvider>
  );
}

export default App;
