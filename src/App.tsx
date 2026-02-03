import { BrowserRouter, Route, Routes } from 'react-router-dom';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/api/ai/upload" element={<UploadFile />} />
        <Route path="/upload-history" element={<UploadHistory />} />
      </Routes>
    </BrowserRouter>
  );
};