import React from 'react';

class GlobalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // שמירת פרטי השגיאה למצב הקומפוננטה בלבד
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px', direction: 'ltr', color: 'black', background: 'white' }}>
                    <h2 style={{ color: 'red' }}>Something went wrong.</h2>
                    <details style={{ whiteSpace: 'pre-wrap', marginTop: '10px' }}>
                        <summary>View Error Details</summary>
                        <p style={{ color: 'red', fontWeight: 'bold' }}>
                            {this.state.error && this.state.error.toString()}
                        </p>
                        <p>Component Stack:</p>
                        <pre style={{ background: '#f0f0f0', padding: '10px', overflowX: 'scroll' }}>
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                        </pre>
                    </details>
                    <div style={{ marginTop: '20px', padding: '10px', background: '#ffebee', border: '1px solid red' }}>
                        <strong>Tip:</strong> If you are in Instagram/Facebook, try opening in Safari/Chrome.
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default GlobalErrorBoundary;
