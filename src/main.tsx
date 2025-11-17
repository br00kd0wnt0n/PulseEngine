import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App'
import Dashboard from './pages/Dashboard'
import Trends from './pages/Trends'
import Upload from './pages/Upload'
import Creators from './pages/Creators'
import Insights from './pages/Insights'
import AdminDashboard from './pages/AdminDashboard'
import RKB from './pages/RKB'
// Removed alternative views; Classic only with persistent Co‑Pilot
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import { ThemeProvider } from './context/ThemeContext'
import { TrendProvider } from './context/TrendContext'
import { CreatorProvider } from './context/CreatorContext'
import { UploadProvider } from './context/UploadContext'
import { LayoutProvider } from './context/LayoutContext'
import { PreferencesProvider } from './context/PreferencesContext'
import { DashboardProvider } from './context/DashboardContext'
import { ToastProvider } from './context/ToastContext'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'trends', element: <Trends /> },
      { path: 'upload', element: <Upload /> },
      { path: 'creators', element: <Creators /> },
      { path: 'insights', element: <Insights /> },
      { path: 'projects', element: <Projects /> },
      { path: 'projects/:id', element: <ProjectDetail /> },
      { path: 'admin', element: <AdminDashboard /> },
      { path: 'rkb', element: <RKB /> },
      // Alternate view routes removed
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
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
    </ThemeProvider>
  </React.StrictMode>
)
