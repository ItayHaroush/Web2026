import React, { Component } from 'react';

class Header extends Component {
    state = {}
    render() {
        return (
            <div className='header-whatsapp'>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '28px', marginLeft: '10px' }}>📱</span>
                    <span>{this.props.brand}</span>
                </div>
                <div style={{
                    fontSize: "14px",
                    opacity: 0.9,
                    marginTop: '5px',
                    display: 'flex',
                    gap: '15px',
                    justifyContent: 'center'
                }}>
                    <span>📋 סה"כ: {this.props.totalContacts}</span>
                    {this.props.favoritesCount > 0 && (
                        <span>⭐ מועדפים: {this.props.favoritesCount}</span>
                    )}
                </div>
            </div>
        );
    }
}

export default Header;