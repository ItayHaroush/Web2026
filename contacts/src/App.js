import React, { Component } from 'react';
import Header from './components/Header';
import Contact from './components/Contact';
import AddPerson from './components/AddPerson';
import SearchBox from './components/SearchBox';

class App extends Component {
  state = {
    newName: "",
    newEmail: "",
    newPhone: "",
    newBirthday: "",
    search: "",
    showAddPerson: false, // תיקנתי את השם של המשתנה
    isEdit: false, // מצב עריכה
    editIndex: null,// אינדקס של איש הקשר שנערך
    sortByName: false, // מיון לפי שם
    sortDirection: "asc", // כיוון המיון
    contacts: [
      { name: 'Itay', email: 'itay@gmail.com', phone: '054-7466508', birthday: '21-12-2025' },
      { name: 'Mike', email: 'miken@gmail.com', phone: '051-2234562', birthday: '05-12-1985' },
      { name: 'Jimi', email: 'jimi@gmail.com', phone: '052-1112345', birthday: '07-07-1992' }
    ]
  }
  componentDidMount() {
    // טען אנשי קשר מה-localStorage אם קיימים
    const contacts = localStorage.getItem("contacts");
    if (contacts) {
      this.setState({ contacts: JSON.parse(contacts) });
    }
  }
  saveContactsToStorage = (contacts) => {
    localStorage.setItem("contacts", JSON.stringify(contacts));
  }

  toggleSort = () => {
    if (!this.state.sortByName) {
      this.setState({ sortByName: true, sortDirection: "asc" });
    } else {
      this.setState(prevState => ({
        sortDirection: prevState.sortDirection === "asc" ? "desc" : "asc"
      }));
    }
  };

  handleDelete = (index) => {
    let answer = window.confirm(`Do you really want to delete ${this.state.contacts[index].name}`);
    if (!answer) {
      return;
    }
    // צור עותק חדש של המער
    let updateArray = this.state.contacts.slice();
    updateArray.splice(index, 1);
    this.setState({ contacts: updateArray }, () => {
      this.saveContactsToStorage(this.state.contacts);
    });
  }

  handleAdd = () => {
    if (this.state.newName == "") {
      return;
    }
    //email regex
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i.test(this.state.newEmail)) {
      //alert("Invalid email address");
      return;
    }
    //phone regex
    if (!/^0[0-9]{1,2}(-)?[0-9]{7,8}$/i.test(this.state.newPhone)) {
      //alert("Invalid phone number");
      return;
    }

    const temp = {
      name: this.state.newName,
      email: this.state.newEmail,
      phone: this.state.newPhone,
      birthday: this.state.newBirthday
    };

    if (this.state.isEdit) {
      // עדכון
      const update = [...this.state.contacts];
      update[this.state.editIndex] = temp;
      this.setState({
        contacts: update,
        newName: "",
        newEmail: "",
        newPhone: "",
        showAddForm: false,
        isEdit: false,
        editIndex: null
      }, () => {
        this.saveContactsToStorage(this.state.contacts);
      });
    } else {
      // הוספה
      const update = [...this.state.contacts, temp];
      this.setState({
        contacts: update,
        newName: "",
        newEmail: "",
        newPhone: "",
        showAddForm: false
      }, () => {
        this.saveContactsToStorage(this.state.contacts);
      });
    }
  }

  // התחלת עריכה
  handleEdit = (index) => {
    const person = this.state.contacts[index];
    this.setState({
      newName: person.name,
      newEmail: person.email,
      newPhone: person.phone,
      newBirthday: person.birthday,
      showAddForm: true,
      isEdit: true,
      editIndex: index
    });
  }
  toggleAddForm = () => {
    this.setState({
      showAddForm: !this.state.showAddForm,
      isEdit: false,
      newName: "",
      newEmail: "",
      newPhone: "",
      newBirthday: "",
      editIndex: null
    });
  }

  handleChange = (event) => {
    event.preventDefault();
    this.setState({ [event.target.name]: event.target.value });
  }

  handleSearchChange = (event) => {
    this.setState({ search: event.target.value });
  }

  render() {
    // סינון אנשי הקשר לפי חיפוש
    const filteredContacts = this.state.contacts.filter(person =>
      person.name.toLowerCase().includes(this.state.search.toLowerCase())
    );
    // מיון אנשי הקשר אם נבחר מיון
    const contactsToShow = this.state.sortByName
      ? [...filteredContacts].sort((a, b) =>
        this.state.sortDirection === "asc"
          ? a.name.localeCompare(b.name, 'he')
          : b.name.localeCompare(a.name, 'he')
      )
      : filteredContacts;

    return (
      <div>
        <Header brand="Contact List" />
        <SearchBox value={this.state.search} onChange={this.handleSearchChange} />
        <button
          style={{ background: 'none', border: 'none', padding: 0, margin: 0 }}
          onClick={this.toggleAddForm}>

          <span
            className='btn btn-outline-secondary btn-sm'
            style={{ cursor: "pointer" }}>+</span>
        </button>
        <button
          className="btn btn-outline-secondary btn-sm"
          onClick={this.toggleSort}
          style={{ margin: '10px' }}>
          {this.state.sortByName ? (this.state.sortDirection === "asc" ? "Z-A" : "A-Z") : "A-Z"}
        </button>
        {this.state.showAddForm && (
          <AddPerson
            newName={this.state.newName}
            newEmail={this.state.newEmail}
            newPhone={this.state.newPhone}
            newBirthday={this.state.newBirthday}
            onChange={this.handleChange}
            onAdd={this.handleAdd}
            isEdit={this.state.isEdit}
          />
        )}
        {
          contactsToShow.map((person, indx) => {
            // בדיקה אם היום יום הולדת
            let isBirthdayToday = false;
            if (person.birthday) {
              let day, month;
              if (/^\d{2}-\d{2}-\d{4}$/.test(person.birthday)) {
                // פורמט dd-mm-yyyy
                [day, month] = person.birthday.split('-');
              } else if (/^\d{4}-\d{2}-\d{2}$/.test(person.birthday)) {
                // פורמט yyyy-mm-dd   
                [, month, day] = person.birthday.split('-');
              }
              if (day && month) {
                const today = new Date();
                isBirthdayToday =
                  today.getDate() === parseInt(day, 10) &&
                  today.getMonth() + 1 === parseInt(month, 10);
              }
            }
            return (
              <div key={indx} style={{ display: 'flex', alignItems: 'center' }}>
                <Contact
                  index={indx}
                  name={person.name}
                  email={person.email}
                  phone={person.phone}
                  birthday={person.birthday}
                  onDelete={this.handleDelete}
                  isBirthdayToday={isBirthdayToday} // prop חדש
                />
                <button
                  className="btn btn-outline-primary btn-sm"
                  style={{ marginRight: 10 }}
                  onClick={() => this.handleEdit(indx)}>Edit</button>
              </div>
            );
          })
        }


      </div>
    );
  }
}

export default App;