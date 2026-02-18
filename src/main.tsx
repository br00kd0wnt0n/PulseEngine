import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App'
import CanvasWorkflow from './pages/CanvasWorkflow'
import Start from './pages/Start'
import Trends from './pages/Trends'
import Upload from './pages/Upload'
import Creators from './pages/Creators'
import Insights from './pages/Insights'
import AdminDashboard from './pages/AdminDashboard'
import RKB from './pages/RKB'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import TrendsAdmin from './pages/TrendsAdmin'
import Prompts from './pages/Prompts'
import Login from './pages/Login'
import ProtectedRoute from './components/Auth/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import { TrendProvider } from './context/TrendContext'
import { CreatorProvider } from './context/CreatorContext'
import { UploadProvider } from './context/UploadContext'
import { LayoutProvider } from './context/LayoutContext'
import { PreferencesProvider } from './context/PreferencesContext'
import { DashboardProvider } from './context/DashboardContext'
import { ToastProvider } from './context/ToastContext'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
if (!GOOGLE_CLIENT_ID) console.warn('[Auth] VITE_GOOGLE_CLIENT_ID is not set — Google Sign-In will fail')

const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: <ProtectedRoute><App /></ProtectedRoute>,
    children: [
      { index: true, element: <CanvasWorkflow /> },
      { path: 'start', element: <Start /> },
      { path: 'canvas', element: <CanvasWorkflow /> },
      { path: 'trends', element: <Trends /> },
      { path: 'upload', element: <Upload /> },
      { path: 'creators', element: <Creators /> },
      { path: 'insights', element: <Insights /> },
      { path: 'projects', element: <Projects /> },
      { path: 'projects/:id', element: <ProjectDetail /> },
      { path: 'admin', element: <AdminDashboard /> },
      { path: 'trends-admin', element: <TrendsAdmin /> },
      { path: 'rkb', element: <RKB /> },
      { path: 'prompts', element: <Prompts /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <PreferencesProvider>
          <LayoutProvider>
            <DashboardProvider>
              <ToastProvider>
                <TrendProvider>
                  <CreatorProvider>
                    <UploadProvider>
                      <RouterProvider router={router} />
                    </UploadProvider>
                  </CreatorProvider>
                </TrendProvider>
              </ToastProvider>
            </DashboardProvider>
          </LayoutProvider>
        </PreferencesProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
)
