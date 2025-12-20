import React, { Component } from 'react';
import Header from './components/Header';
import Contact from './components/Contact';
import AddPerson from './components/AddPerson';

class App extends Component {
  state = { 
    newName:"", 
    newEmail:"", 
    newPhone:"",
    contacts:[
      {name:'Doron', email:'doron@gmail.com', phone:'054-234345'},
      {name:'Mike', email:'miken@gmail.com', phone:'051-2234562'},
      {name:'Jimi', email:'jimi@gmail.com', phone:'052-1112345'}
    ]
   } 

   handleDelete = (index)=>{
        let answer = window.confirm(`Do you really want to delete ${this.state.contacts[index].name}`);
        if(!answer){
          return;
        }
        //let updateArray = this.state.contacts.filter((person, i)=> i!=index);
        //this.setState({contacts: updateArray});
        let updateArray = this.state.contacts;
        updateArray.splice(index, 1);
        this.setState({contacts: updateArray});
   }

   handleAdd2 = () =>{
      const temp = [
        {
        name: this.state.newName,
        email: this.state.newEmail,
        phone: this.state.newPhone,        
        }
      ];
      const updateArray = temp.concat(this.state.contacts); 
      this.setState({contacts: updateArray});
   }

   handleAdd = () =>{
      if(this.state.newName==""){
        return;
      }
      //email regex
      if(!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i.test(this.state.newEmail)){
        //alert("Invalid email address");
        return;
      }
      //phone regex
      if(!/^0[0-9]{1,2}(-)?[0-9]{7,8}$/i.test(this.state.newPhone)){
        //alert("Invalid phone number");
        return;
      }
      const temp = {
        name: this.state.newName,
        email: this.state.newEmail,
        phone: this.state.newPhone,        
      };

      const update = this.state.contacts; 
      update.push(temp);
      this.setState({contacts: update});
      //איפוס השדות
      this.setState({newName: "", newEmail: "", newPhone: ""});

   }

   handleAdd1 = () =>{
      //splice
   }

   handleChange = (event)=>{
      event.preventDefault();
      this.setState({[event.target.name]:event.target.value});
   }

  render() { 
    return (
    <div>
      <Header brand="Contact List"/>
      <span Style="font-size:50px;color:navy; cursor:pointer;">&#128104;&#8205;&#43;</span>
      <AddPerson
        newName={this.state.newName}
        newEmail={this.state.newEmail}
        newPhone={this.state.newPhone}
        onChange = {this.handleChange}
        onAdd = {this.handleAdd}
      />
      {
        this.state.contacts.map( (person, indx)=>(
            <Contact key={indx}
                    index={indx}
                    name={person.name}
                    email={person.email}
                    phone={person.phone}
                    onDelete={this.handleDelete}

            />
        ))
      }


    </div>
    );
  }
}
 
export default App;