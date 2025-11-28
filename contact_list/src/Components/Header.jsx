import React, { Component } from 'react';

class Header extends Component {
    state = {}
    render() {
        return (
            <div className='header-whatsapp'>
                <span style={{ fontSize: '28px', marginLeft: '10px' }}>📱</span>
                {this.props.brand}
            </div>
        );
    }
}

export default Header;