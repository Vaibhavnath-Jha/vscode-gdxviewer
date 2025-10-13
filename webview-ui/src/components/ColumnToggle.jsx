import React, { useState } from 'react';
import './styles/ColumnToggle.css';

function ColumnToggle({ table }) {
    const [isOpen, setIsOpen] = useState(false);

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (isOpen && !event.target.closest('.column-toggle-container')) {
                setIsOpen(false);
            }
        };
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, [isOpen]);

    return (
        <div className="column-toggle-container">
            <button onClick={() => setIsOpen(!isOpen)} className="toggle-button">
                Columns
            </button>
            {isOpen && (
                <div className="column-toggle-dropdown">
                    <label>
                        <input
                            type="checkbox"
                            checked={table.getIsAllColumnsVisible()}
                            onChange={table.getToggleAllColumnsVisibilityHandler()}
                        />
                        Toggle All
                    </label>
                    <hr />
                    {table.getAllLeafColumns().map(column => (
                        <label key={column.id}>
                            <input
                                type="checkbox"
                                checked={column.getIsVisible()}
                                onChange={column.getToggleVisibilityHandler()}
                            />
                            {column.id}
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}

export default ColumnToggle;
