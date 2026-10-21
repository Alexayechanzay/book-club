import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider } from './contexts/AuthContext'
import { LocaleProvider } from './contexts/LocaleContext'
import { Auth } from './pages/Auth'
import { Browse } from './pages/Browse'
import { CreateSession } from './pages/CreateSession'
import { Home } from './pages/Home'
import { JoinPrivate } from './pages/JoinPrivate'
import { Landing } from './pages/Landing'
import { Profile } from './pages/Profile'
import { SessionDetail } from './pages/SessionDetail'

export default function App() {
  return (
    <LocaleProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Landing />} />
            <Route path="auth" element={<Auth />} />
            <Route
              path="home"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route
              path="browse"
              element={
                <ProtectedRoute>
                  <Browse />
                </ProtectedRoute>
              }
            />
            <Route
              path="create"
              element={
                <ProtectedRoute>
                  <CreateSession />
                </ProtectedRoute>
              }
            />
            <Route
              path="join"
              element={
                <ProtectedRoute>
                  <JoinPrivate />
                </ProtectedRoute>
              }
            />
            <Route
              path="sessions/:id"
              element={
                <ProtectedRoute>
                  <SessionDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </LocaleProvider>
  )
}
