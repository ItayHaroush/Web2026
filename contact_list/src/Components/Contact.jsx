import React, { Component } from 'react';

class Contact extends Component {
       state = { 
        showFlag:false
     } 

    onShow = () => {
            this.setState({showFlag: !this.state.showFlag});
    }

    render() { 
        return (
        <div className='card card-body mb-3'>
           <h3>   
                  {this.props.name} 
                  <span onClick={ ()=>this.onShow()} style={{cursor:"pointer"}}>
                   &#11206;</span> 
           </h3>
           {
            this.state.showFlag?(
                <ul className='list-group'>
                    <li className='list-group-item'>Email: {this.props.email}</li>
                    <li className='list-group-item'>Phone: {this.props.phone}</li>
                </ul>
            ):null
           }
           
        </div>
        );
    }
}
 
export default Contact;