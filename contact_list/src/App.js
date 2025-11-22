import React, { Component } from 'react';
import Header from './Components/Header';
import Contact from './Components/Contact';

class App extends Component {
  state = { 
    contacts:[
      {name:'Doron', email:'doron@gmail.com', phone:'054-234345'},
      {name:'Mike', email:'miken@gmail.com', phone:'051-2234562'},
      {name:'Jimi', email:'jimi@gmail.com', phone:'052-1112345'}
    ]
   } 
  render() { 
    return (
    <div>
      <Header brand="Contact List"/>
      {
        this.state.contacts.map( (person, indx)=>(
            <Contact key={indx}
                    name={person.name}
                    email={person.email}
                    phone={person.phone}
            />
        ))
      }


    </div>
    );
  }
}
 
export default App;