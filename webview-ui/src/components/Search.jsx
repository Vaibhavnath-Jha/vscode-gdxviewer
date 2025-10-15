import './styles/Search.css';

/**
 * A controlled input component for live searching symbols.
 * @param {object} props
 * @param {string} props.searchTerm - The current value of the search input.
 * @param {function(string): void} props.onSearchChange - Callback that fires on every change to the input.
 */
function Search({ searchTerm, onSearchChange }) {
    return (
        <div className="symbol-search-container">
            <input
                type="search"
                className="symbol-search"
                placeholder="Search for a symbol"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
            />
        </div>
    );
}

export default Search;