import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ProjectList from './pages/ProjectList';
import ProjectCreate from './pages/ProjectCreate';
import ProjectDetail from './pages/ProjectDetail';
import LibrariesPage from './pages/LibrariesPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/projects" element={<ProjectList />} />
      <Route path="/projects/new" element={<ProjectCreate />} />
      <Route path="/projects/:id" element={<ProjectDetail />} />
      <Route path="/library" element={<LibrariesPage />} />
      <Route path="/templates" element={<LibrariesPage />} />
      <Route path="/videos" element={<LibrariesPage />} />
      <Route path="/audio" element={<LibrariesPage />} />
    </Routes>
  );
}

export default App;
