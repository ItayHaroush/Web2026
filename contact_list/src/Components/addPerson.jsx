import React, { Component } from 'react';

class AddPerson extends Component {
  render() {
    return (
      <div className="form-container">
        <h4 style={{ textAlign: 'center', marginBottom: '20px', color: '#075E54' }}>
          {this.props.isEditing ? "✏️ עריכת איש קשר" : "➕ הוספת איש קשר חדש"}
        </h4>

        {/* הטופס – שולח ל-handleChangeAdd שב-App */}
        <form onSubmit={this.props.onAdd}>

          {/* שם */}
          <label>
            👤 שם
            <input
              type="text"
              name="newName"
              placeholder="הכנס שם מלא..."
              value={this.props.newName}
              onChange={this.props.onChange}
            />
          </label>

          {/* אימייל */}
          <label>
            📧 אימייל
            <input
              type="email"
              name="newEmail"
              placeholder="example@email.com"
              value={this.props.newEmail}
              onChange={this.props.onChange}
            />
          </label>

          {/* טלפון */}
          <label>
            📱 טלפון
            <input
              type="text"
              name="newPhone"
              placeholder="050-1234567"
              value={this.props.newPhone}
              onChange={this.props.onChange}
            />
          </label>

          {/* יום הולדת */}
          <label>
            🎂 יום הולדת
            <input
              type="date"
              name="newBirthday"
              value={this.props.newBirthday}
              onChange={this.props.onChange}
            />
          </label>

          {/* כפתור שמתעדכן לפי מצב – הוספה/עדכון */}
          <button type="submit">
            {this.props.isEditing ? "✔️ עדכן איש קשר" : "➕ הוסף איש קשר"}
          </button>

        </form>
      </div>
    );
  }
}

export default AddPerson;