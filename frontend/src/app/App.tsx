import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "./layout/MainLayout";
import { DataProvider } from "@/shared/data/DataContext";
import Dashboard from "@/features/dashboard/Dashboard";
import ChatPage from "@/features/chat/ChatPage";
import UploadPage from "@/features/upload/UploadPage";

export default function App() {
  return (
    <DataProvider>
      <Router
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Router>
    </DataProvider>
  );
}
