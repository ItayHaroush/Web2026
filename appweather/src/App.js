import './App.css';
import React, { Component } from 'react';

// פונקציה שמחזירה אייקון מותאם אישית לפי יום/לילה
function getCustomIcon(icon) {
  if (icon === '01d') {
    // שמש יום
    return '🌞';
  }
  if (icon === '01n') {
    // ירח לילה
    return '🌜';
  }
  // אייקון ברירת מחדל מה-API
  return <img style={{width: '48px'}} src={`https://openweathermap.org/img/wn/${icon}@2x.png`} alt="icon" />;
}

// קומפוננטת מזג אוויר מבוססת מחלקה
class WeatherApp extends Component {
  // state ראשוני: עיר, תוצאות, הודעת שגיאה
  state = {
    city: '',
    cityArray: ['חיפה','עפולה', 'תל אביב', 'חיפה', 'ירושלים', 'באר שבע', 'אשדוד', 'נתניה', 'רמת גן', 'פתח תקווה'],
    results: [],
    error: ''
  };

  // עדכון שם העיר לפי קלט המשתמש
  handleChange = (e) => {
    this.setState({ city: e.target.value });
  };

  // שליפת נתוני מזג אוויר מה-API
  fetchWeather = async () => {
    const apiKey = 'dd8bff93c38776dc57397b428c93325d';
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${this.state.city}&appid=${apiKey}&units=metric&lang=he`;
    this.setState({ error: '' }); // איפוס שגיאה קודמת
    try {
      const res = await fetch(url); // שליחת בקשה ל-API
      const data = await res.json(); // המרת התשובה ל-JSON
      if (data.cod === 200) {
        // אם התקבלה תשובה תקינה, הוספתה לראש המערך
        this.setState(prev => ({
          results: [data, ...prev.results],
          city: '' // איפוס שדה העיר
        }));
      } else {
        // טיפול במקרה של עיר לא קיימת
        this.setState({ error: 'לא נמצאו נתונים לעיר שהוזנה' });
      }
    } catch {
      // טיפול בשגיאת רשת/שרת
      this.setState({ error: 'שגיאה בשליפת נתונים' });
    }
  };

  render() {
    return (
      <div  style={{ direction: 'rtl', textAlign: 'center', marginTop: '40px' }}>
        <h1>בדיקת מזג אוויר</h1>
        <select
          value={this.state.city}
          onChange={this.handleChange}
          style={{ padding: '8px', fontSize: '16px', marginRight: '10px' }}
        >
          <option value="" disabled>
            בחר עיר
          </option>
          {this.state.cityArray.map((cityName) => (
            <option key={cityName} value={cityName}>
              {cityName}
            </option>
          ))}
        </select>
        {/* שדה קלט לעיר */}
        <input
          type="text"
          placeholder="הכנס שם עיר"
          value={this.state.city}
          onChange={this.handleChange}
          style={{ padding: '8px', fontSize: '16px' }}
        />
        {/* כפתור לשליפת מזג האוויר */}
        <button onClick={this.fetchWeather} style={{ marginRight: '10px', padding: '8px 16px' }}>
          בדוק
        </button>
        {/* הצגת הודעת שגיאה במידת הצורך */}
        {this.state.error && <div style={{ color: 'red' }}>{this.state.error}</div>}
        <div  style={{ marginTop: '20px' }}>
          {/* הצגת כל התוצאות שנשמרו במערך */}
          {this.state.results.map((weather, idx) => (
            <div
              key={weather.id + idx}
              style={{
                border: '1px solid #eee',
                borderRadius: '8px',
                display: 'inline-block',
                padding: '20px',
                margin: '10px',
                background: '#f9f9f9',
                minWidth: '220px'
              }}
            >
               <h2>{weather.name}</h2>
              {/* אייקון משתנה לפי יום/לילה */}
              <div className="weather-icon" style={{ fontSize: '48px', marginBottom: '10px' }}>
                {getCustomIcon(weather.weather[0].icon)}
              </div> <p>{weather.weather[0].description}</p>
              <p>טמפרטורה: {weather.main.temp}°C</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
}

export default WeatherApp;
