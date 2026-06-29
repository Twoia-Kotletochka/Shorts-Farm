import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/pages/DashboardPage'
import { LibraryPage } from '@/pages/LibraryPage'
import { CreatePage } from '@/pages/CreatePage'
import { QueuePage } from '@/pages/QueuePage'
import { ShortsPage } from '@/pages/ShortsPage'
import { SubtitlesPage } from '@/pages/SubtitlesPage'
import { SettingsPage } from '@/pages/SettingsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'library', element: <LibraryPage /> },
      { path: 'create', element: <CreatePage /> },
      { path: 'queue', element: <QueuePage /> },
      { path: 'shorts', element: <ShortsPage /> },
      { path: 'subtitles', element: <SubtitlesPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])
