import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Events from './pages/Events'
import Championships from './pages/Championships'
import Registration from './pages/Registration'
import Drivers from './pages/Drivers'
import Categories from './pages/Categories'
import LiveTiming from './pages/LiveTiming'
import Results from './pages/Results'
import Statistics from './pages/Statistics'
import Admin from './pages/Admin'
import { healthApi } from './services/api'

const WorldMap = lazy(() => import('./pages/WorldMap'))

function MaintenanceScreen() {
  return (
    <div className="min-h-screen bg-racing-dark text-white flex items-center justify-center px-4">
      <div className="max-w-xl text-center border border-racing-red/30 bg-racing-card rounded-lg p-8 shadow-racing">
        <img
          src="/logo.png"
          alt="Logo CADPO"
          className="h-20 w-20 object-contain mx-auto mb-6"
          onError={event => { event.currentTarget.style.display = 'none' }}
        />
        <p className="text-racing-red text-xs uppercase tracking-widest font-semibold mb-3">
          Mantenimiento
        </p>
        <h1 className="font-racing text-4xl font-bold mb-4">
          Sitio no disponible
        </h1>
        <p className="text-gray-300 leading-relaxed">
          La página de CADPO está en mantenimiento y no disponible. Estamos revisando la conexión con la base de datos.
        </p>
      </div>
    </div>
  )
}

function App() {
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const res = await healthApi.check()
        setStatus(res.data?.available ? 'available' : 'maintenance')
      } catch (err) {
        console.error('Health check error:', err)
        setStatus('maintenance')
      }
    }

    checkAvailability()
  }, [])

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-racing-dark text-white flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-racing-red border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (status === 'maintenance') {
    return <MaintenanceScreen />
  }

  return (
    <div className="min-h-screen bg-racing-dark text-white flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/eventos" element={<Events />} />
          <Route path="/proximas-fechas" element={<Events initialStatus="upcoming" />} />
          <Route path="/campeonatos" element={<Championships />} />
          <Route path="/proximos-campeonatos" element={<Championships initialStatus="upcoming" />} />
          <Route path="/historico" element={<Championships initialStatus="completed" />} />
          <Route path="/tiempos-en-vivo" element={<LiveTiming />} />
          <Route path="/resultados" element={<Results />} />
          <Route path="/estadisticas" element={<Statistics />} />
          <Route
            path="/mapa-mundial"
            element={(
              <Suspense fallback={<div className="flex min-h-[70vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-racing-red border-t-transparent" /></div>}>
                <WorldMap />
              </Suspense>
            )}
          />
          <Route path="/inscripcion" element={<Registration />} />
          <Route path="/pilotos" element={<Drivers />} />
          <Route path="/categorias" element={<Categories />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
