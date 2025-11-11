import { useEffect, useMemo, useState } from 'react'

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

function SeniorView() {
  const [userId, setUserId] = useState('demo-patient')
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const today = useMemo(() => new Date().toLocaleDateString(), [])

  const fetchStatus = async () => {
    try {
      setLoading(true)
      setError('')
      const res = await fetch(`${API_BASE}/api/senior/today?user_id=${encodeURIComponent(userId)}`)
      if (!res.ok) throw new Error('Failed to fetch status')
      const data = await res.json()
      setStatus(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStatus() }, [userId])

  const nextPending = useMemo(() => {
    if (!status?.items) return null
    const pending = status.items.filter(i => i.status !== 'taken')
    if (pending.length === 0) return null
    // pick earliest by scheduled_time
    return pending.sort((a,b) => new Date(a.scheduled_time) - new Date(b.scheduled_time))[0]
  }, [status])

  const handleConfirm = async () => {
    if (!nextPending) return
    try {
      setLoading(true)
      setError('')
      const res = await fetch(`${API_BASE}/api/senior/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          medication_id: nextPending.medication_id,
          scheduled_time_iso: nextPending.scheduled_time
        })
      })
      if (!res.ok) throw new Error('Failed to confirm dose')
      await fetchStatus()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">Today's Medication Status</h1>
        <p className="text-gray-600">{today}</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded p-3 mb-4 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-2xl shadow p-6">
        {loading ? (
          <p className="text-center">Loading...</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4 text-lg">
              <span>Taken</span>
              <span className="font-semibold">{status?.taken ?? 0}/{status?.total_doses ?? 0}</span>
            </div>
            <button
              onClick={handleConfirm}
              disabled={!nextPending}
              className={`w-full py-5 text-xl font-bold rounded-2xl transition-colors ${nextPending ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
            >
              Confirm
            </button>
            <p className="mt-3 text-center text-sm text-gray-600">
              {nextPending ? 'Next dose scheduled at ' + new Date(nextPending.scheduled_time).toLocaleTimeString() : 'All doses confirmed for today'}
            </p>
          </>
        )}
      </div>

      <div className="mt-6 text-center">
        <label className="block text-sm text-gray-600 mb-1">Patient ID</label>
        <input value={userId} onChange={e=>setUserId(e.target.value)} className="w-full border rounded px-3 py-2" />
      </div>
    </div>
  )
}

function CaregiverView() {
  const [patientId, setPatientId] = useState('demo-patient')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchData = async () => {
    try {
      setLoading(true)
      setError('')
      const res = await fetch(`${API_BASE}/api/caregiver/dashboard?patient_id=${encodeURIComponent(patientId)}`)
      if (!res.ok) throw new Error('Failed to load dashboard')
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [patientId])

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Caregiver Dashboard</h1>
        <div className="flex items-center gap-2">
          <input value={patientId} onChange={e=>setPatientId(e.target.value)} className="border rounded px-3 py-2" />
          <button onClick={fetchData} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Refresh</button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded p-3 mb-4 text-sm">{error}</div>
      )}

      {loading && <p>Loading...</p>}

      {!loading && data && (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="col-span-2 bg-white rounded-xl shadow p-5">
            <h2 className="font-semibold mb-3">Medication History (30 days)</h2>
            <div className="space-y-2 max-h-96 overflow-auto">
              {data.history.map((h) => (
                <div key={h.id} className="flex items-center justify-between text-sm border-b pb-2">
                  <div>
                    <div className="font-medium">{h.medication_id}</div>
                    <div className="text-gray-600">Scheduled: {h.scheduled_time ? new Date(h.scheduled_time).toLocaleString() : '-'}</div>
                  </div>
                  <div className={`px-2 py-1 rounded text-white ${h.status === 'taken' ? 'bg-green-600' : h.status === 'missed' ? 'bg-red-600' : 'bg-gray-400'}`}>
                    {h.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow p-5">
              <h2 className="font-semibold mb-3">Missed Doses (7 days)</h2>
              <div className="space-y-2">
                {data.missed.length === 0 && <p className="text-sm text-gray-600">No missed doses in the last week.</p>}
                {data.missed.map(m => (
                  <div key={m.id} className="text-sm">
                    <div className="font-medium">{m.medication_id}</div>
                    <div className="text-gray-600">{m.scheduled_time ? new Date(m.scheduled_time).toLocaleString() : '-'}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow p-5">
              <h2 className="font-semibold mb-3">Inventory Alerts</h2>
              <div className="space-y-2">
                {data.inventory_alerts.length === 0 && <p className="text-sm text-gray-600">All inventories look good.</p>}
                {data.inventory_alerts.map(a => (
                  <div key={a.medication_id} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{a.name}</div>
                      <div className="text-gray-600">{a.inventory_count} left (threshold {a.low_threshold})</div>
                    </div>
                    <span className="text-red-600 font-semibold">Low</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function App() {
  const [mode, setMode] = useState('senior')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white/80 backdrop-blur sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-bold">MediCare Network</div>
          <div className="flex gap-2">
            <button onClick={() => setMode('senior')} className={`px-3 py-2 rounded ${mode==='senior' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Senior</button>
            <button onClick={() => setMode('caregiver')} className={`px-3 py-2 rounded ${mode==='caregiver' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Caregiver</button>
          </div>
        </div>
      </header>

      <main className="py-8">
        {mode === 'senior' ? <SeniorView /> : <CaregiverView />}
      </main>
    </div>
  )
}

export default App
