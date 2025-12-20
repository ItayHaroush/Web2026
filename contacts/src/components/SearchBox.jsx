import React from 'react';
import "./SearchBox.css";

const SearchBox = ({ value, onChange }) => (
    <input
        className="search-box"
        type="text"
        placeholder="חפש איש קשר..."
        value={value}
        onChange={onChange}
        style={{ margin: '10px', padding: '5px', fontSize: '16px' }}
    />
);

export default SearchBox;