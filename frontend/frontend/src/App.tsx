import { useEffect, useState } from 'react'

function App() {
  const [apiStatus, setApiStatus] = useState('checking...')

  useEffect(() => {
    // Check backend health
    fetch(`${import.meta.env.VITE_API_URL}/health`)
      .then(res => res.json())
      .then(() => setApiStatus('✅ Connected'))
      .catch(() => setApiStatus('❌ Disconnected'))
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-4">
          Skylark Drones Mining IoT System
        </h1>
        
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6">System Status</h2>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-gray-600">API Status</p>
              <p className="text-xl font-bold text-blue-600">{apiStatus}</p>
            </div>
            
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-gray-600">Frontend</p>
              <p className="text-xl font-bold text-green-600">✅ Ready</p>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t">
            <h3 className="text-lg font-bold mb-4">Next Steps</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>Set up Raspberry Pi with GPS modules</li>
              <li>Complete backend microservices</li>
              <li>Implement Mapbox dashboard</li>
              <li>Deploy to Railway</li>
              <li>Record Hindi demo video</li>
            </ul>
          </div>
        </div>

        <p className="text-white text-center mt-8 text-sm">
          Execution started: Day 1 of 7-10 day sprint
        </p>
      </div>
    </div>
  )
}

export default App
