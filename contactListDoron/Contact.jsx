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
                  <span onClick={ ()=>this.onShow()} Style="cursor:pointer;">
                       {this.state.showFlag ? <>&#11205;</> : <>&#11206;</> }    
                  </span>
                  <span Style="float:right; cursor: pointer;" 
                        onClick={()=>this.props.onDelete(this.props.index)}>&#10060;</span>

           </h3>
           {
            this.state.showFlag?(
                <ul className='list-group'>
                    <li className='list-group-item'>Email: {this.props.email}</li>
                    <li className='list-group-item'>Phone: {this.props.phone}</li>
                </ul>
            ):null
           }
           
        </div>);
    }
}
 
export default Contact;