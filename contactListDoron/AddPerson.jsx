import React, { Component } from 'react';
import "./AddPerson.css";

class AddPerson extends Component {

    handleSubmit = (e) => {
        e.preventDefault(); // מונע ריענון הדף
        this.props.onAdd(); // מפעיל את פונקציית ההוספה מה־props
    }

    render() { 
        return (
            <form id="add" onSubmit={this.handleSubmit}>
                <label>
                    Name:
                    <input 
                        type="text" 
                        name="newName" 
                        value={this.props.newName} 
                        onChange={this.props.onChange}
                        required
                    />
                </label>

                <label>
                    Email:
                    <input 
                        type="email" 
                        name="newEmail"
                        value={this.props.newEmail}
                        pattern="^[a-zA-Z0-9](?:[a-zA-Z0-9_%+-]|(?:\.[a-zA-Z0-9_%+-]))*@([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$"
                        title="Invalid Email"
                        onChange={this.props.onChange}
                        required
                    />
                </label>

                <label>
                    Phone:
                    <input 
                        type="phone" 
                        name="newPhone" 
                        value={this.props.newPhone} 
                        pattern='^0[0-9]{1,2}(-)?[0-9]{7,8}$'
                        title='Invalid phone number'
                        onChange={this.props.onChange}
                        required
                    />
                </label>

                <input type="submit" value="Save" />
            </form>
        );
    }
}
 
export default AddPerson;
