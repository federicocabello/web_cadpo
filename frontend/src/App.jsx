import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import Events from './pages/Events'
import Championships from './pages/Championships'
import Registration from './pages/Registration'
import Drivers from './pages/Drivers'

function App() {
  return (
    <div className="min-h-screen bg-racing-dark text-white flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/eventos" element={<Events />} />
          <Route path="/campeonatos" element={<Championships />} />
          <Route path="/inscripcion" element={<Registration />} />
          <Route path="/pilotos" element={<Drivers />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App
