import React from 'react';
import './styles/Pagination.css';

function Pagination({
    table,
    totalRecords,
    goToPageValue,
    onGoToPageValueChange,
    onGoToPage,
    onPageSizeChange
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
                <span style={{ marginRight: "8px" }} > Total Records: <strong>{totalRecords}</strong></span>
                <span>
                    Page Size:
                    <select
                        className="page-rows"
                        value={table.getState().pagination.pageSize}
                        onChange={e => {
                            onPageSizeChange(Number(e.target.value));
                        }}
                    >
                        <option value="50">50</option>
                        <option value="100">100</option>
                        <option value="200">200</option>
                    </select>
                </span>
            </div>
        </div>
    );
}

export default Pagination;