import React, { Component } from 'react';
import './App.css';
import Header from './Components/Header';
import Contact from './Components/Contact';
import AddPerson from "./Components/addPerson";
import Search from './Components/search';
import defaultImage from './Components/images/defaultUser.jpg';

class App extends Component {
  state = {
    // שדות הטופס
    addShow: false,
    newName: '',
    newEmail: '',
    newPhone: '',

    //שדה הודעה
    toastMessage: '',
    toastColor: 'success',
    showToast: false,

    // שדה החיפוש
    search: '',

    // למצב עריכה 
    editIndex: null,   // איזה אינדקס אנחנו עורכים כרגע
    isEditing: false,  // האם כרגע אנחנו במצב עריכה

    // רשימת אנשי הקשר
    contacts: [
      { name: 'Doron', email: 'doron@gmail.com', phone: '054-234345' },
      { name: 'Mike', email: 'miken@gmail.com', phone: '051-2234562' },
      { name: 'Jimi', email: 'jimi@gmail.com', phone: '052-1112345' }
    ]
  };
  // פונקציה שתציג את ההודעה לזמן קצר
  showToast = (msg, color = "success") => {
    this.setState({
      toastMessage: msg,
      toastColor: color,
      showToast: true
    });

    setTimeout(() => {
      this.setState({ showToast: false });
    }, 2000);
  }
  // שמירה ללוקאל סטורג'
  saveToLocal = () => {
    // localStorage שומר רק טקסט → JSON.stringify להפוך למחרוזת
    localStorage.setItem("contacts", JSON.stringify(this.state.contacts));
  }

  // טעינה מהלוקאל סטורג' כשהאפליקציה עולה
  componentDidMount() {
    const saved = localStorage.getItem("contacts");

    // אם יש נתונים שמורים → נטען אותם ל־state
    if (saved) {
      this.setState({ contacts: JSON.parse(saved) });
    }
  }

  // כל שינוי ב־contacts → שמירה ללוקאל
  componentDidUpdate(prevProps, prevState) {
    if (prevState.contacts !== this.state.contacts) {
      this.saveToLocal();
    }
  }

  // הוספה / עדכון של איש קשר
  handleChangeAdd = (event) => {
    event.preventDefault();

    // בדיקות תקינות בסיסיות
    if (this.state.newName === '' || this.state.newEmail === '' || this.state.newPhone === '') {
      alert("All fields are required");
      return;
    }
    if (!this.state.newEmail.includes('@')) {
      alert("Invalid email address");
      return;
    }
    if (this.state.newPhone.length < 10) {
      alert("Invalid phone number");
      return;
    }

    // ✔️ מצב עריכה – מעדכן איש קיים
    if (this.state.isEditing) {
      let temp = [...this.state.contacts]; // העתק כדי לא לשנות ישירות
      temp[this.state.editIndex] = {
        name: this.state.newName,
        email: this.state.newEmail,
        phone: this.state.newPhone,
        image: defaultImage
      };

      // שמירת העריכה
      this.setState({
        contacts: temp,
        newName: '',
        newEmail: '',
        newPhone: '',
        isEditing: false,
        editIndex: null,
        addShow: false,

      });
      this.showToast("Contact Updated: " + this.state.newName, "success");
      return; // חשוב! שלא ימשיך להוספה
    }
    // ✔️ מצב הוספה – יוצר איש קשר חדש
    const newContact = {
      name: this.state.newName,
      email: this.state.newEmail,
      phone: this.state.newPhone,
      image: defaultImage
    };

    // מוסיף לרשימה
    this.setState({
      contacts: [...this.state.contacts, newContact],
      newName: '',
      newEmail: '',
      newPhone: '',
      addShow: false,
    });
    this.showToast("Contact Added: " + this.state.newName, "success");
  }

  // שינוי ערכי הטופס / שדה החיפוש
  handleChange = (event) => {
    // [event.target.name] → מזהה איזה שדה משתנה
    this.setState({ [event.target.name]: event.target.value });

  }

  // מחיקת איש קשר
  handleDelete = (index) => {
    if (!window.confirm("Are you sure you want to delete " + this.state.contacts[index].name + "?")) return;

    let tempContacts = [...this.state.contacts];
    tempContacts.splice(index, 1); // מוחק לפי אינדקס
    this.setState({ contacts: tempContacts });
    this.showToast("Success Contact Deleted: " + this.state.contacts[index].name, "danger");
  }

  // כניסה למצב עריכה → ממלא את הטופס מחדש
  handleEdit = (index) => {
    const contact = this.state.contacts[index];

    this.setState({
      newName: contact.name,
      newEmail: contact.email,
      newPhone: contact.phone,
      editIndex: index,   // מי נערך?
      isEditing: true,     // עובר למצב עריכה
      addShow: true,
      newImage: contact.image
    });

  }
  // העלאת תמונה
  handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = () => {
      this.setState({ newImage: reader.result });
    };

    reader.readAsDataURL(file);
  };

  render() {
    return (
      <div>
        <Header brand="Contact List" />

        {/* טופס הוספה / עריכה */}
        {this.state.addShow && (
          <AddPerson
            newName={this.state.newName}
            newEmail={this.state.newEmail}
            newPhone={this.state.newPhone}
            onChange={this.handleChange}
            onAdd={this.handleChangeAdd}
            onImageChange={this.handleImageChange}
            isEditing={this.state.isEditing}
            addShow={this.state.addShow}
          />
        )}

        {/* כפתור להוספת איש קשר */}
        <button
          className="btn-add-contact"
          onClick={() => this.setState({ addShow: !this.state.addShow })}
        >
          {this.state.addShow ? "✖️ סגור טופס" : "➕ הוסף איש קשר חדש"}
        </button>


        {/* שורת החיפוש */}
        <Search
          search={this.state.search}
          onChange={this.handleChange}
        />

        {/* מיפוי הרשימה אחרי סינון */}
        {
          this.state.contacts
            .filter(person => {
              const term = this.state.search.toLowerCase();

              // מנקה מקפים ורווחים
              const cleanPhone = person.phone.replace(/[-\s]/g, '');


              return (
                person.name.toLowerCase().includes(term) ||
                cleanPhone.toLowerCase().includes(term) ||
                person.email.toLowerCase().includes(term)
              );
            })
            .map((person, indx) => (
              <Contact
                key={indx}
                index={indx}
                name={person.name}
                email={person.email}
                phone={person.phone}
                image={person.image || defaultImage}
                onDelete={this.handleDelete}
                onEdit={this.handleEdit}
              />
            ))}
        {/* הודעת טוסט */}
        {this.state.showToast && (
          <div className={`toast-whatsapp ${this.state.toastColor}`}>
            {this.state.toastMessage}
          </div>
        )}
      </div>
    );
  }
}

export default App;