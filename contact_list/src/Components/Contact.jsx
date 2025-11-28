import React, { Component } from 'react';

class Contact extends Component {

    state = {
        showFlag: false  // האם להציג פרטים
    }

    // פתיחה/סגירה של פרטי איש קשר
    onShow = () => {
        this.setState({ showFlag: !this.state.showFlag });
    }

    render() {
        const {
            name,
            email,
            phone,
            image,
            favorite,
            index,
            onEdit,
            onDelete,
            onFavorite
        } = this.props;

        // ניקוי מספר טלפון ל-WhatsApp
        const cleanPhone = phone.replace(/[-\s()]/g, '');
        // אם המספר לא מתחיל ב-+ או 972, נוסיף 972
        const whatsappPhone = cleanPhone.startsWith('+') ? cleanPhone.substring(1)
            : cleanPhone.startsWith('972') ? cleanPhone
                : cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1)
                    : '972' + cleanPhone;

        return (
            <div
                className="contact-card"
                onClick={this.onShow}
                style={{ cursor: "pointer" }}
            >
                {/* אזור עליון - תמונה + שם + כפתורים */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center' }}>

                        {/* תמונת פרופיל */}
                        <img
                            src={image}
                            alt={name}
                            style={{
                                width: "50px",
                                height: "50px",
                                borderRadius: "50%",
                                objectFit: "cover",
                                marginLeft: "10px",
                            }}
                        />

                        {/* שם */}
                        <h5 style={{ margin: 0, fontWeight: 'bold' }}>{name}</h5>
                    </div>

                    {/* אייקונים */}
                    <div style={{ display: 'flex', gap: '5px' }}>

                        {/* הצגה/הסתרה */}
                        <span
                            className="icon-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                this.onShow();
                            }}
                            title="הצג/הסתר פרטים"
                        >
                            {this.state.showFlag ? "▼" : "▶"}
                        </span>

                        {/* מועדפים ⭐ */}
                        <span
                            className="wa-icon"
                            onClick={(e) => {
                                e.stopPropagation();
                                onFavorite(name);
                            }}
                            style={{
                                color: favorite ? "gold" : "#ccc",
                                fontSize: "22px",
                                cursor: "pointer"
                            }}
                            title="סמן כמועדף"
                        >
                            ⭐
                        </span>

                        {/* עריכה */}
                        <span
                            className="icon-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit(name);
                            }}
                            title="ערוך"
                        >
                            ✏️
                        </span>

                        {/* מחיקה */}
                        <span
                            className="icon-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(name);
                            }}
                            title="מחק"
                        >
                            ❌
                        </span>
                    </div>
                </div>

                {/* פרטי איש קשר בפתיחה */}
                {this.state.showFlag && (
                    <div className="contact-details">
                        <p><strong>📧 אימייל:</strong> {email}</p>
                        <p><strong>📱 טלפון:</strong> {phone}</p>

                        {/* כפתורי פעולה */}
                        <div style={{
                            display: 'flex',
                            gap: '10px',
                            marginTop: '15px',
                            flexWrap: 'wrap'
                        }}>
                            {/* שליחת מייל */}
                            <a
                                href={`mailto:${email}`}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    flex: '1 1 calc(50% - 5px)',
                                    minWidth: '120px',
                                    padding: '10px 15px',
                                    background: '#075E54',
                                    color: 'white',
                                    textDecoration: 'none',
                                    borderRadius: '8px',
                                    textAlign: 'center',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    transition: 'all 0.3s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '5px'
                                }}
                                onMouseEnter={(e) => e.target.style.background = '#128C7E'}
                                onMouseLeave={(e) => e.target.style.background = '#075E54'}
                                title="שלח מייל"
                            >
                                📧 מייל
                            </a>

                            {/* התקשרות */}
                            <a
                                href={`tel:${phone}`}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    flex: '1 1 calc(50% - 5px)',
                                    minWidth: '120px',
                                    padding: '10px 15px',
                                    background: '#0088cc',
                                    color: 'white',
                                    textDecoration: 'none',
                                    borderRadius: '8px',
                                    textAlign: 'center',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    transition: 'all 0.3s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '5px'
                                }}
                                onMouseEnter={(e) => e.target.style.background = '#006699'}
                                onMouseLeave={(e) => e.target.style.background = '#0088cc'}
                                title="התקשר"
                            >
                                📞 התקשר
                            </a>

                            {/* WhatsApp */}
                            <a
                                href={`https://wa.me/${whatsappPhone}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    flex: '1 1 calc(50% - 5px)',
                                    minWidth: '120px',
                                    padding: '10px 15px',
                                    background: '#25D366',
                                    color: 'white',
                                    textDecoration: 'none',
                                    borderRadius: '8px',
                                    textAlign: 'center',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    transition: 'all 0.3s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '5px'
                                }}
                                onMouseEnter={(e) => e.target.style.background = '#128C7E'}
                                onMouseLeave={(e) => e.target.style.background = '#25D366'}
                                title="פתח ב-WhatsApp"
                            >
                                💬 WhatsApp
                            </a>

                            {/* SMS */}
                            <a
                                href={`sms:${phone}`}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    flex: '1 1 calc(50% - 5px)',
                                    minWidth: '120px',
                                    padding: '10px 15px',
                                    background: '#FF9800',
                                    color: 'white',
                                    textDecoration: 'none',
                                    borderRadius: '8px',
                                    textAlign: 'center',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    transition: 'all 0.3s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '5px'
                                }}
                                onMouseEnter={(e) => e.target.style.background = '#F57C00'}
                                onMouseLeave={(e) => e.target.style.background = '#FF9800'}
                                title="שלח SMS"
                            >
                                💌 SMS
                            </a>
                        </div>
                    </div>
                )}
            </div>
        );
    }
}

export default Contact;