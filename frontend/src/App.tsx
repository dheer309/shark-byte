import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/Landing'
import Auth from './pages/Auth'
import DashboardLayout from './pages/dashboard/Layout'
import Overview from './pages/dashboard/Overview'
import Attendance from './pages/dashboard/Attendance'
import EquipmentPage from './pages/dashboard/Equipment'
import Societies from './pages/dashboard/Societies'
import Leaderboard from './pages/dashboard/Leaderboard'
import Profile from './pages/dashboard/Profile'
import LinkCard from './pages/LinkCard'

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/link-card" element={<LinkCard />} />

      {/* Dashboard */}
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<Overview />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="equipment" element={<EquipmentPage />} />
        <Route path="societies" element={<Societies />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="profile" element={<Profile />} />
      </Route>
    </Routes>
  )
}
