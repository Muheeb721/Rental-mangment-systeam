import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log for diagnostics
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught error:', error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    // Optionally reload the page to reset app state
    if (this.props.reloadOnRetry) window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <h3>Something went wrong</h3>
          <p>We encountered an error while loading this part of the app.</p>
          <div style={{ marginTop: 12 }}>
            <button onClick={this.handleReload} style={{ marginRight: 8 }}>Retry</button>
            <button onClick={() => window.location.href = '/'}>Go Home</button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
