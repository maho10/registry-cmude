import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ScanPage from "./pages/ScanPage";
import ParticipantPage from "./pages/ParticipantPage";
import LoginPage from "./pages/admin/LoginPage";
import DashboardPage from "./pages/admin/DashboardPage";
import ParticipantsPage from "./pages/admin/ParticipantsPage";
import ParticipantDetailPage from "./pages/admin/ParticipantDetailPage";
import AdminLayout from "./pages/admin/AdminLayout";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/scan" replace />} />
        <Route path="/scan" element={<ScanPage />} />
        <Route path="/p/:id" element={<ParticipantPage />} />
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="participants" element={<ParticipantsPage />} />
          <Route path="participants/:id" element={<ParticipantDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
