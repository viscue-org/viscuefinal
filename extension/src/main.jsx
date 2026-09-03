import React, { Component } from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './styles.css';
import App from './App.jsx';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Viscue Workspace Error:', error, errorInfo);
  }

  handleReset = () => {
    try {
      if (globalThis.chrome?.storage?.local) {
        chrome.storage.local.remove('viscue-react-workspace');
      } else {
        localStorage.removeItem('viscue-react-workspace');
      }
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', width: '100vw', background: '#0F1822', color: '#F7FAFC', fontFamily: '"Instrument Sans", system-ui, sans-serif',
          padding: '24px', textAlign: 'center', boxSizing: 'border-box'
        }}>
          <div style={{
            background: '#182838', border: '1px solid #2D4358', borderRadius: '16px',
            padding: '32px 40px', maxWidth: '520px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }}>
            <h2 style={{ color: '#8BA4BD', margin: '0 0 12px 0', fontSize: '20px', fontWeight: 600 }}>Workspace Recovery</h2>
            <p style={{ color: '#B8C5D1', fontSize: '14px', lineHeight: '1.6', margin: '0 0 20px 0' }}>
              {this.state.error?.message || 'A temporary visual rendering issue occurred.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                onClick={() => window.location.reload()} 
                style={{
                  padding: '10px 20px', background: 'rgba(255,255,255,0.12)', color: '#FFF',
                  border: 'none', borderRadius: '12px', fontWeight: '600', cursor: 'pointer'
                }}
              >
                Reload Page
              </button>
              <button 
                onClick={this.handleReset} 
                style={{
                  padding: '10px 20px', background: '#5B7593', color: '#FFFFFF',
                  border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer'
                }}
              >
                Reset & Open Fresh Canvas
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
