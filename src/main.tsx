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
import Projects from './pages/Projects'
import { ThemeProvider } from './context/ThemeContext'
import { TrendProvider } from './context/TrendContext'
import { CreatorProvider } from './context/CreatorContext'
import { UploadProvider } from './context/UploadContext'
import { LayoutProvider } from './context/LayoutContext'
import { PreferencesProvider } from './context/PreferencesContext'
import { DashboardProvider } from './context/DashboardContext'

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
      { path: 'admin', element: <AdminDashboard /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <PreferencesProvider>
        <LayoutProvider>
          <DashboardProvider>
            <TrendProvider>
              <CreatorProvider>
                <UploadProvider>
                  <RouterProvider router={router} />
                </UploadProvider>
              </CreatorProvider>
            </TrendProvider>
          </DashboardProvider>
        </LayoutProvider>
      </PreferencesProvider>
    </ThemeProvider>
  </React.StrictMode>
)
