import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }
  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught', error, info);
    this.setState({ error, info });
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24 }}>
          <h2>Er is een fout opgetreden</h2>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#fff', padding: 12, borderRadius: 8, border: '1px solid #eee' }}>{String(this.state.error && this.state.error.toString())}</pre>
          <details style={{ marginTop: 10 }}>
            <summary>Details</summary>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.info?.componentStack}</pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
