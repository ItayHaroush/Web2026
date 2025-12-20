import React, { Component } from 'react';

class Header extends Component {
    state = {  } 
    render() { 
        return (
        <nav className='navbar navbar-dark bg-primary p-3'>
            <div className='container'>
                <a href="/" className='navbar-brand'>
                   {this.props.brand}
                </a>
            </div>
            <ul className='navbar-nav mr-auto'>
                 <li className='nav-item'>
                    <a href="/" className='nav-link' 
                    Style="color:black; font-weight:bold;">Home</a>
                 </li>
            </ul>
        </nav>);
    }
}
 
export default Header;