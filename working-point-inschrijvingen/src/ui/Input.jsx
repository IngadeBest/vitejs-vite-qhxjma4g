import React from 'react';

const Input = React.forwardRef(({ label, ...props }, ref) => {
    return (
        <div className="input-container">
            {label && <label className="input-label">{label}</label>}
            <input ref={ref} className="input-field" {...props} />
        </div>
    );
});

Input.displayName = 'Input';

export default Input;