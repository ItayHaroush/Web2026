import React, { Component } from 'react';

class Search extends Component {
    render() {
        return (
            <div className="search-container">
                {/* שדה חיפוש – עובד על state.search שנמצא ב-App */}
                <input
                    type="text"
                    name="search"
                    placeholder="🔍 חפש לפי שם, טלפון או אימייל..."
                    value={this.props.search}     // הערך מגיע מה-App
                    onChange={this.props.onChange} // מעדכן את ה-App
                />
            </div>
        );
    }
}

export default Search;