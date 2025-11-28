import React, { Component } from 'react';
import './App.css';
import Header from './Components/Header';
import Contact from './Components/Contact';
import AddPerson from "./Components/addPerson";
import Search from './Components/search';
import defaultUserImage from './Components/images/defaultUser.jpg';

class App extends Component {
  // כמה אנשי קשר בעמוד
  contactsPerPage = 10;

  state = {
    // שליטה על הטופס
    addShow: false,

    // שדות הטופס
    newName: '',
    newEmail: '',
    newPhone: '',

    // חיפוש
    search: '',

    // עריכה
    editIndex: null,
    isEditing: false,

    // פאג'ינציה
    currentPage: 1,

    // כרטיסיות: 'all' או 'favorites'
    activeTab: 'all',

    // טוסטים
    toastMessage: '',
    toastColor: 'success',
    showToast: false,

    // אנשי קשר
    contacts: [
      { name: 'Doron', email: 'doron@gmail.com', phone: '054-234345', image: defaultUserImage, favorite: false },
      { name: 'Mike', email: 'miken@gmail.com', phone: '051-2234562', image: defaultUserImage, favorite: false },
      { name: 'Jimi', email: 'jimi@gmail.com', phone: '052-1112345', image: defaultUserImage, favorite: false }
    ]
  };

  // טוסט קצר
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
    localStorage.setItem("contacts", JSON.stringify(this.state.contacts));
  }

  componentDidMount() {
    const saved = localStorage.getItem("contacts");
    if (saved) {
      this.setState({ contacts: JSON.parse(saved) });
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.contacts !== this.state.contacts) {
      this.saveToLocal();
    }
  }

  // שינוי בשדות טופס / חיפוש
  handleChange = (event) => {
    this.setState({ [event.target.name]: event.target.value });
  }

  // הוספה / עדכון איש קשר
  handleChangeAdd = (event) => {
    event.preventDefault();

    const { newName, newEmail, newPhone, isEditing, editIndex } = this.state;

    if (!newName || !newEmail || !newPhone) {
      this.showToast("All fields are required", "warning");
      return;
    }
    if (!newEmail.includes('@')) {
      this.showToast("Invalid email address", "warning");
      return;
    }
    if (newPhone.length < 10) {
      this.showToast("Invalid phone number", "warning");
      return;
    }

    const contactsCopy = [...this.state.contacts];

    // מצב עריכה
    if (isEditing && editIndex !== null) {

      const oldFavorite = contactsCopy[editIndex].favorite;

      contactsCopy[editIndex] = {
        name: newName,
        email: newEmail,
        phone: newPhone,
        image: defaultUserImage,
        favorite: oldFavorite
      };

      this.setState({
        contacts: contactsCopy,
        newName: '',
        newEmail: '',
        newPhone: '',
        isEditing: false,
        editIndex: null,
        addShow: false
      });

      this.showToast("Contact updated: " + newName, "info");
      return;
    }

    // מצב הוספה
    const newContact = {
      name: newName,
      email: newEmail,
      phone: newPhone,
      image: defaultUserImage,
      favorite: false
    };

    this.setState(prev => ({
      contacts: [...prev.contacts, newContact],
      newName: '',
      newEmail: '',
      newPhone: '',
      addShow: false,
      currentPage: 1 // חוזרים לעמוד ראשון
    }), () => {
      this.showToast("Contact added: " + newName, "success");
    });
  }

  // מחיקה - מקבל שם של איש קשר
  handleDelete = (contactName) => {
    const contactsCopy = [...this.state.contacts];
    const index = contactsCopy.findIndex(c => c.name === contactName);

    if (index === -1) return;

    const name = contactsCopy[index].name;
    if (!window.confirm("Delete " + name + "?")) return;

    contactsCopy.splice(index, 1);

    this.setState({ contacts: contactsCopy }, () => {
      this.showToast("Contact deleted: " + name, "danger");
    });
  }

  // כניסה למצב עריכה - מקבל שם של איש קשר
  handleEdit = (contactName) => {
    const contactsCopy = [...this.state.contacts];
    const index = contactsCopy.findIndex(c => c.name === contactName);

    if (index === -1) return;

    const contact = contactsCopy[index];

    this.setState({
      newName: contact.name,
      newEmail: contact.email,
      newPhone: contact.phone,
      editIndex: index,
      isEditing: true,
      addShow: true
    });
  }

  // מועדפים - מקבל שם של איש קשר כדי למצוא אותו
  toggleFavorite = (contactName) => {
    const contactsCopy = [...this.state.contacts];
    const index = contactsCopy.findIndex(c => c.name === contactName);

    if (index !== -1) {
      contactsCopy[index].favorite = !contactsCopy[index].favorite;
      this.setState({ contacts: contactsCopy });
    }
  }

  // סינון (שם + מייל + טלפון)
  getFilteredContacts = () => {
    const term = this.state.search.toLowerCase();
    let filtered = this.state.contacts;

    // סינון לפי כרטיסיה
    if (this.state.activeTab === 'favorites') {
      filtered = filtered.filter(person => person.favorite);
    }

    // סינון לפי חיפוש
    if (term) {
      filtered = filtered.filter(person => {
        const cleanPhone = person.phone.replace(/[-\s]/g, '');
        return (
          person.name.toLowerCase().includes(term) ||
          person.email.toLowerCase().includes(term) ||
          cleanPhone.includes(term)
        );
      });
    }

    return filtered;
  }

  render() {
    const filtered = this.getFilteredContacts();
    const { currentPage, activeTab } = this.state;
    const start = (currentPage - 1) * this.contactsPerPage;
    const pageContacts = filtered.slice(start, start + this.contactsPerPage);
    const totalPages = Math.max(1, Math.ceil(filtered.length / this.contactsPerPage));
    const favoritesCount = this.state.contacts.filter(c => c.favorite).length;

    return (
      <div>
        <Header
          brand="Contact List"
          totalContacts={this.state.contacts.length}
          favoritesCount={favoritesCount}
        />

        {/* כרטיסיות */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '15px',
          background: 'white',
          padding: '10px',
          borderRadius: '10px'
        }}>
          <button
            onClick={() => this.setState({ activeTab: 'all', currentPage: 1 })}
            style={{
              flex: 1,
              padding: '12px',
              background: activeTab === 'all' ? 'var(--whatsapp-green)' : '#f0f0f0',
              color: activeTab === 'all' ? 'white' : '#666',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
          >
            📝 כל האנשים ({this.state.contacts.length})
          </button>
          <button
            onClick={() => this.setState({ activeTab: 'favorites', currentPage: 1 })}
            style={{
              flex: 1,
              padding: '12px',
              background: activeTab === 'favorites' ? 'var(--whatsapp-green)' : '#f0f0f0',
              color: activeTab === 'favorites' ? 'white' : '#666',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
          >
            ⭐ מועדפים ({favoritesCount})
          </button>
        </div>

        {/* טופס הוספה / עריכה */}
        {this.state.addShow && (
          <AddPerson
            newName={this.state.newName}
            newEmail={this.state.newEmail}
            newPhone={this.state.newPhone}
            onChange={this.handleChange}
            onAdd={this.handleChangeAdd}
            isEditing={this.state.isEditing}
          />
        )}

        {/* כפתור טופס */}
        <button
          className="btn-add-contact"
          onClick={() => this.setState({ addShow: !this.state.addShow })}
        >
          {this.state.addShow ? "✖️ סגור טופס" : "➕ הוסף איש קשר חדש"}
        </button>

        {/* חיפוש */}
        <Search
          search={this.state.search}
          onChange={this.handleChange}
        />

        {/* רשימת אנשי קשר – 10 בעמוד */}
        {pageContacts.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            background: 'white',
            borderRadius: '10px',
            color: '#999'
          }}>
            <div style={{ fontSize: '60px', marginBottom: '15px' }}>
              {activeTab === 'favorites' ? '⭐' : '🔍'}
            </div>
            <h3 style={{ color: '#666' }}>
              {activeTab === 'favorites'
                ? 'אין אנשי קשר מועדפים'
                : this.state.search
                  ? 'לא נמצאו תוצאות'
                  : 'אין אנשי קשר'}
            </h3>
            <p>
              {activeTab === 'favorites'
                ? 'לחץ על ⭐ כדי להוסיף אנשי קשר למועדפים'
                : this.state.search
                  ? 'נסה חיפוש אחר'
                  : 'התחל להוסיף אנשי קשר'}
            </p>
          </div>
        ) : (
          pageContacts.map((person, idx) => {
            const globalIndex = start + idx; // אינדקס אמיתי ברשימה המלאה

            return (
              <Contact
                key={globalIndex}
                index={globalIndex}
                name={person.name}
                email={person.email}
                phone={person.phone}
                image={person.image}
                favorite={person.favorite}
                onDelete={this.handleDelete}
                onEdit={this.handleEdit}
                onFavorite={this.toggleFavorite}
              />
            );
          })
        )}

        {/* פאג'ינציה */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '15px',
            marginTop: '20px',
            padding: '15px',
            background: 'white',
            borderRadius: '10px'
          }}>
            <button
              style={{
                padding: '10px 20px',
                background: currentPage === 1 ? '#ccc' : 'var(--whatsapp-green)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontWeight: 'bold'
              }}
              disabled={currentPage === 1}
              onClick={() => this.setState({ currentPage: currentPage - 1 })}
            >
              ◀ הקודם
            </button>

            <span style={{ fontWeight: 'bold', color: 'var(--whatsapp-text)' }}>
              עמוד {currentPage} / {totalPages}
            </span>

            <button
              style={{
                padding: '10px 20px',
                background: currentPage >= totalPages ? '#ccc' : 'var(--whatsapp-green)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                fontWeight: 'bold'
              }}
              disabled={currentPage >= totalPages}
              onClick={() => this.setState({ currentPage: currentPage + 1 })}
            >
              הבא ▶
            </button>
          </div>
        )}

        {/* טוסט */}
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