import React, { useState, useEffect, useRef } from 'react';

export const DebouncedInput = React.memo(({ value, onChange, debounceTime = 300, ...props }) => {
  const [innerValue, setInnerValue] = useState(value);
  const debounceRef = useRef(null);

  useEffect(() => {
    setInnerValue(value);
  }, [value]);

  const handleChange = (e) => {
    const val = e.target.value;
    setInnerValue(val);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      onChange(val);
    }, debounceTime);
  };

  return <input {...props} value={innerValue} onChange={handleChange} />;
});

export const DebouncedTextarea = React.memo(({ value, onChange, debounceTime = 300, ...props }) => {
  const [innerValue, setInnerValue] = useState(value);
  const debounceRef = useRef(null);

  useEffect(() => {
    setInnerValue(value);
  }, [value]);

  const handleChange = (e) => {
    const val = e.target.value;
    setInnerValue(val);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      onChange(val);
    }, debounceTime);
  };

  return <textarea {...props} value={innerValue} onChange={handleChange} />;
});
