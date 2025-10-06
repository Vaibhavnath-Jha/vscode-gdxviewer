import React from 'react';

function Pagination({
    table,
    totalRecords,
    goToPageValue,
    onGoToPageValueChange,
    onGoToPage
}) {
    return (
        <div className="pagination" >
            <button onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>&laquo; First</button>
            <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>&lsaquo; Prev</button>
            <span>
                Page{' '}
                <input
                    type="number"
                    className="page-input"
                    value={goToPageValue}
                    onChange={e => onGoToPageValueChange(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && onGoToPage()}
                    min="1"
                    max={table.getPageCount()}
                />
                <strong>
                    / {table.getPageCount()}
                </strong>
            </span>
            <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next &rsaquo;</button>
            <button onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>Last &raquo;</button>
            <div className="rightAlignRecords">
                <span> Total Records: <strong>{totalRecords}</strong></span>
            </div>
        </div>
    );
}

export default Pagination;