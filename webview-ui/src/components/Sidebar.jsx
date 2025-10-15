import { forwardRef } from 'react';
import Search from './Search';
import './styles/Sidebar.css';

const Sidebar = forwardRef(({
    style,
    children,
    searchTerm,
    onSearchChange,
    categoriesToRender,
    expandedCats,
    onToggleCategory,
    filteredSymbolIndex,
    selectedSymbol,
    onSelectSymbol
}, ref) => {
    return (
        <div className="sidebar" ref={ref} style={style}>
            <Search searchTerm={searchTerm} onSearchChange={onSearchChange} />
            <div className="category-list-container">
                {categoriesToRender.map(cat => (
                    <div key={cat}>
                        <button
                            className={`category ${expandedCats[cat] ? 'expanded' : ''}`}
                            onClick={() => onToggleCategory(cat)}
                        >
                            <div className={`cat-icon ${expandedCats[cat] ? 'expanded' : ''}`}>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M6 4l4 4-4 4z" />
                                </svg>
                            </div>
                            <span className="category-label">{cat}</span>
                        </button>
                        {expandedCats[cat] && (
                            <div className="symbol-list-container">
                                <ul className="tables-list">
                                    {(filteredSymbolIndex[cat] || []).length > 0 ? (
                                        filteredSymbolIndex[cat].map(tname => (
                                            <li
                                                key={tname}
                                                className={`table-li ${selectedSymbol === tname ? 'selected' : ''}`}
                                                onClick={() => onSelectSymbol(tname, cat)}
                                            >
                                                {tname}
                                            </li>
                                        ))
                                    ) : (<div className="none-li">None</div>)}
                                </ul>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            {children}
        </div>
    );
});

export default Sidebar;