import './App.css';
import React, { Component } from 'react';

const API_KEY = 'dd8bff93c38776dc57397b428c93325d';

// פונקציה שמחזירה אייקון מותאם אישית לפי יום/לילה
function getCustomIcon(icon) {
  if (icon.endsWith('01d')) {
    // אייקון יום כללי
    return '☀️';
  }
  if (icon.endsWith('01n')) {
    // אייקון לילה כללי
    return '🌙';
  }
  // אייקון ברירת מחדל מה-API
  return <img style={{ width: '48px' }} src={`https://openweathermap.org/img/wn/${icon}@2x.png`} alt="icon" />;
}

// קומפוננטת מזג אוויר מבוססת מחלקה
class WeatherApp extends Component {
  hasFetchedInitial = false; // מונע שליפה כפולה בסביבת StrictMode
  // state ראשוני: עיר, תוצאות, הודעת שגיאה
  state = {
    city: '',
    cityArray: ['חיפה', 'עפולה', 'תל אביב', 'ירושלים', 'באר שבע', 'אשדוד', 'נתניה', 'רמת גן', 'פתח תקווה'],
    results: [],
    error: '',
    favorites: JSON.parse(localStorage.getItem('favorites') || '[]'),
    theme: 'sunny',
    videoError: false
  };

  componentDidMount() {
    this.updateBodyTheme('sunny');
    if (!this.hasFetchedInitial) {
      this.hasFetchedInitial = true;
      this.getCurrentLocationWeather();
    }
  }
  // הוספת עיר למועדפים
  // הוספת עיר למועדפים (שומר גם מידע אם קיים)
  addToFavorites = (cityName) => {
    this.setState(prev => {
      // בדוק אם כבר קיים במועדפים
      if (prev.favorites.some(fav => (typeof fav === 'string' ? fav : fav.name) === cityName)) {
        return null;
      }
      // חפש מידע עדכני מהתוצאות
      const weatherData = prev.results.find(w => w.name === cityName);
      const newFavorite = weatherData
        ? { name: cityName, temp: weatherData.main.temp, desc: weatherData.weather[0].description, icon: weatherData.weather[0].icon }
        : { name: cityName };
      const newFavorites = [...prev.favorites, newFavorite];
      localStorage.setItem('favorites', JSON.stringify(newFavorites));
      return { favorites: newFavorites };
    });
  };

  // הסרת עיר מהמועדפים
  removeFromFavorites = (cityName) => {
    this.setState(prev => {
      const newFavorites = prev.favorites.filter(fav => (typeof fav === 'string' ? fav : fav.name) !== cityName);
      localStorage.setItem('favorites', JSON.stringify(newFavorites));
      return { favorites: newFavorites };
    });
  };

  // עדכון שם העיר לפי קלט המשתמש
  handleChange = (e) => {
    this.setState({ city: e.target.value });
  };

  // שליפת נתוני מזג אוויר לפי שם עיר
  fetchWeather = async () => {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${this.state.city}&appid=${API_KEY}&units=metric&lang=he`;
    await this.fetchWeatherFromUrl(url, 'לא נמצאו נתונים לעיר שהוזנה');
  };

  // שליפת נתוני מזג אוויר לפי כתובת URL מלאה
  fetchWeatherFromUrl = async (url, notFoundMessage, isCurrentLocation = false) => {
    this.setState({ error: '' });
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.cod === 200) {
        const theme = this.getThemeFromWeather(data);
        this.updateBodyTheme(theme);
        const enriched = { ...data, isCurrentLocation };
        this.setState(prev => ({
          results: [
            enriched,
            ...prev.results.filter(
              item => item.id !== data.id && (!isCurrentLocation || !item.isCurrentLocation)
            )
          ],
          city: '',
          theme
        }));
      } else {
        this.setState({ error: notFoundMessage || 'לא נמצאו נתונים' });
      }
    } catch {
      this.setState({ error: 'שגיאה בשליפת נתונים' });
    }
  };

  // שליפת מזג אוויר לפי מיקום נוכחי של המשתמש
  getCurrentLocationWeather = () => {
    if (!navigator.geolocation) {
      this.setState({ error: 'הדפדפן לא תומך במיקום' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${coords.latitude}&lon=${coords.longitude}&appid=${API_KEY}&units=metric&lang=he`;
        this.fetchWeatherFromUrl(url, 'לא נמצאו נתונים למיקום הנוכחי', true);
      },
      () => this.setState({ error: 'לא ניתן לקבל את המיקום' })
    );
  };

  getThemeFromWeather = (weather) => {
    if (!weather || !weather.weather || !weather.weather[0]) return 'sunny';
    const { main, id } = weather.weather[0];
    if (['Rain', 'Drizzle', 'Thunderstorm'].includes(main)) return 'rainy';
    // עננות כבדה (803/804) תוצג כרקע גשום/כהה
    if (main === 'Clouds' && id >= 803) return 'rainy';
    return 'sunny';
  };

  updateBodyTheme = (theme) => {
    const body = document.body;
    if (!body) return;
    body.classList.remove('bg-sunny', 'bg-rainy');
    body.classList.add(theme === 'rainy' ? 'bg-rainy' : 'bg-sunny');
  };

  getVideoSource = (theme) => {
    // שימוש בקבצים מקומיים ב-public/videos
    if (theme === 'rainy') {
      return '/videos/rainy.mp4';
    }
    return '/videos/sunny.mp4';
  };

  render() {
    return (
      <div className="page-shell">
        <div className="bg-video-wrapper" aria-hidden="true">
          <video
            key={`${this.state.theme}-${this.state.videoError ? 'fallback' : 'main'}`}
            className="bg-video"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onError={() => this.setState({ videoError: true })}
          >
            <source src={this.state.videoError ? this.getVideoSource('sunny') : this.getVideoSource(this.state.theme)} type="video/mp4" />
          </video>
          <div className="bg-overlay" />
        </div>

        <div className="App">
          <h1>בדיקת מזג אוויר</h1>
          {/* מועדפים */}
          <div style={{ margin: '16px 0' }}>
            <h3>מיקומים מועדפים</h3>
            {this.state.favorites.length === 0 && <div style={{ color: '#888' }}>אין מיקומים מועדפים</div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px' }}>
              {this.state.favorites.map(fav => (
                <span key={typeof fav === 'string' ? fav : fav.name} style={{ background: '#e3f2fd', borderRadius: '16px', padding: '6px 14px', margin: '2px', display: 'inline-flex', alignItems: 'center', fontSize: '15px', minWidth: '120px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <b>{typeof fav === 'string' ? fav : fav.name}</b>
                    {fav.icon && <span className="weather-icon" style={{ fontSize: 22 }}>{getCustomIcon(fav.icon)}</span>}
                    {fav.temp !== undefined && <span style={{ marginRight: 4 }}>{fav.temp}°C</span>}
                    {fav.desc && <span style={{ color: '#555', marginRight: 4 }}>{fav.desc}</span>}
                  </span>
                  <button onClick={() => this.removeFromFavorites(typeof fav === 'string' ? fav : fav.name)} style={{ marginRight: '6px', background: 'transparent', color: '#d32f2f', border: 'none', fontSize: '18px', cursor: 'pointer', padding: 0 }} title="הסר מהמועדפים">×</button>
                </span>
              ))}
            </div>
          </div>
          <select
            value={this.state.city}
            onChange={this.handleChange}
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
          />
          {/* כפתור לשליפת מזג האוויר */}
          <button onClick={this.fetchWeather}>
            בדוק
          </button>

          {/* הצגת הודעת שגיאה במידת הצורך */}
          {this.state.error && <div className="error">{this.state.error}</div>}
          <div style={{ marginTop: '20px' }}>
            {/* הצגת כל התוצאות שנשמרו במערך */}
            {this.state.results.map((weather, idx) => {
              const isFav = this.state.favorites.some(fav => (typeof fav === 'string' ? fav : fav.name) === weather.name);
              return (
                <div
                  key={weather.id + idx}
                  className="weather-card mini"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h2 style={{ fontSize: '1.1em', margin: 0 }}>{weather.name}</h2>
                      {weather.isCurrentLocation && (
                        <span style={{ background: '#e0f7fa', color: '#00796b', borderRadius: '12px', padding: '4px 10px', fontSize: '0.85em' }}>
                          מיקום נוכחי
                        </span>
                      )}
                    </div>
                    <span className="weather-icon" style={{ fontSize: 28 }}>{getCustomIcon(weather.weather[0].icon)}</span>
                  </div>
                  <p style={{ margin: '6px 0', fontSize: '0.95em' }}>{weather.weather[0].description}</p>
                  <p style={{ margin: '6px 0', fontSize: '0.95em' }}>טמפ׳: {weather.main.temp}°C</p>
                  {/* נתונים נוספים */}
                  <p style={{ margin: '6px 0', fontSize: '0.9em', color: '#4682b4' }}>
                    לחות: {weather.main.humidity}% | רוח: {weather.wind.speed} מ"ש
                  </p>
                  <p style={{ margin: '6px 0', fontSize: '0.9em', color: '#4682b4' }}>
                    טמפ׳ מינ׳: {weather.main.temp_min}°C | טמפ׳ מקס׳: {weather.main.temp_max}°C
                  </p>

                  {/* כפתור הוספה למועדפים מתוך כרטיס */}
                  {!isFav && (
                    <button onClick={() => this.addToFavorites(weather.name)} style={{ background: '#ffd600', color: '#333', marginTop: '6px', fontSize: '0.95em', padding: '6px 10px', maxWidth: 120 }}>
                      הוסף למועדפים
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
}

export default WeatherApp;
