// 화면 주소. GitHub Pages는 서버 설정이 없어서 주소 뒤 #/... 방식(HashRouter)을 쓴다.
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from '../pages/HomePage';
import { NewManuscriptPage } from '../pages/NewManuscriptPage';
import { ManuscriptPage } from '../pages/ManuscriptPage';
import { CutEditorPage } from '../pages/CutEditorPage';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/new" element={<NewManuscriptPage />} />
        <Route path="/m/:msId" element={<ManuscriptPage />} />
        <Route path="/m/:msId/cut/:cutId" element={<CutEditorPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
