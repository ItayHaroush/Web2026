import React, { Component } from 'react';

class Contact extends Component {

    state = {
        showFlag: false  // האם להציג פרטים
    }

    // פתיחה/סגירה של פרטי איש הקשר
    onShow = () => {
        this.setState({ showFlag: !this.state.showFlag });
    }

    render() {
        return (
            <div className="contact-card" onClick={this.onShow}>
                {/* אזור עליון - תמונה + שם + כפתורים */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <img
                            src={this.props.image}
                            alt={this.props.name}
                            style={{
                                width: "50px",
                                height: "50px",
                                borderRadius: "50%",
                                objectFit: "cover",
                                marginLeft: "10px"
                            }}
                        />
                        <h5 style={{ margin: 0, fontWeight: 'bold' }}>{this.props.name}</h5>
                    </div>

                    <div style={{ display: 'flex', gap: '5px' }}>
                        <span
                            className="icon-btn"
                            onClick={(e) => { e.stopPropagation(); this.onShow(); }}
                            title="הצג/הסתר פרטים"
                        >
                            {this.state.showFlag ? "▼" : "▶"}
                        </span>

                        <span
                            className="icon-btn"
                            onClick={(e) => { e.stopPropagation(); this.props.onEdit(this.props.index); }}
                            title="ערוך"
                        >
                            ✏️
                        </span>

                        <span
                            className="icon-btn"
                            onClick={(e) => { e.stopPropagation(); this.props.onDelete(this.props.index); }}
                            title="מחק"
                        >
                            ❌
                        </span>
                    </div>
                </div>

                {/* פרטים נוספים */}
                {this.state.showFlag && (
                    <div className="contact-details">
                        <p><strong>📧 אימייל:</strong> {this.props.email}</p>
                        <p><strong>📱 טלפון:</strong> {this.props.phone}</p>
                    </div>
                )}

            </div>
        );
    }
}

export default Contact;