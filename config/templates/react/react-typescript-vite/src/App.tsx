import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      textAlign: 'center',
      padding: '20px'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '2rem' }}>
        React + TypeScript + Vite
      </h1>

      <div style={{
        background: 'rgba(255, 255, 255, 0.1)',
        padding: '2rem',
        borderRadius: '12px',
        backdropFilter: 'blur(10px)',
        maxWidth: '600px'
      }}>
        <p style={{ fontSize: '1.2rem', marginBottom: '2rem' }}>
          A modern starter template with monitoring support
        </p>

        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={() => setCount((count) => count + 1)}
            style={{
              background: 'white',
              color: '#667eea',
              border: 'none',
              padding: '12px 24px',
              fontSize: '1rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'transform 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            Count is {count}
          </button>
        </div>

        <p style={{ fontSize: '0.9rem', opacity: 0.9 }}>
          Edit <code style={{
            background: 'rgba(0, 0, 0, 0.2)',
            padding: '2px 8px',
            borderRadius: '4px'
          }}>src/App.tsx</code> and save to test HMR
        </p>
      </div>

      <div style={{ marginTop: '3rem', fontSize: '0.9rem', opacity: 0.8 }}>
        <p>Click the button to test React state management</p>
        <p style={{ marginTop: '1rem' }}>
          🚀 Built with Vite • ⚛️ React 18 • 🔷 TypeScript
        </p>
      </div>
    </div>
  )
}

export default App
