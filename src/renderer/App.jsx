import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Browser from './pages/Browser';
import FileManager from './pages/FileManager';
import DownloadManager from './pages/DownloadManager';
import ScriptManager from './pages/ScriptManager';
import Bookmarks from './pages/Bookmarks';
import History from './pages/History';
import Settings from './pages/Settings';
import ContainerManager from './pages/ContainerManager';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/browser" replace />} />
          <Route path="browser" element={<Browser />} />
          <Route path="containers" element={<ContainerManager />} />
          <Route path="bookmarks" element={<Bookmarks />} />
          <Route path="history" element={<History />} />
          <Route path="files" element={<FileManager />} />
          <Route path="downloads" element={<DownloadManager />} />
          <Route path="scripts" element={<ScriptManager />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
