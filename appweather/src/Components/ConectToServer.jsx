import React, { Component } from 'react';

class ConectToServer extends Component {
    state = {
        data: null,
        error: null
    };
    componentDidMount() {
        // אם PHP רץ על פורט אחר (לדוגמה 8000), שנה את ה-URL
        // React dev server לא מריץ PHP, צריך שרת PHP נפרד
        fetch('http://localhost:3000/server.php?name=John')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.text();
            })
            .then(data => {
                this.setState({ data: data, error: null });
            })
            .catch(error => {
                console.error('Error:', error);
                this.setState({ error: error.message, data: null });
            });
    }
    render() {
        return (
            <div>
                <h1> {this.state.data || 'אין חיבור לשרת'}</h1>
            </div>
        );
    }
}

export default ConectToServer;