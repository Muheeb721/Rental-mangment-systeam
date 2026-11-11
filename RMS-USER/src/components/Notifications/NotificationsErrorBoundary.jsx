import React from 'react'

class NotificationsErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // Log the error for debugging; avoid exposing secrets
    // In future, send to remote logging service if configured
    // eslint-disable-next-line no-console
    console.error('NotificationsErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20 }}>
          <h3>Notifications are temporarily unavailable</h3>
          <p>Please refresh the page or try again later.</p>
        </div>
      )
    }
    return this.props.children
  }
}

export default NotificationsErrorBoundary
