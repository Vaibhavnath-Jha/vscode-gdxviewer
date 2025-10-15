import { flexRender } from '@tanstack/react-table';
import ColumnToggle from './ColumnToggle';
import './styles/Table.css';

/**
 * A controlled input component for rendering the Tanstack table.
 * @param {string} props.selectedTable - The current selected symbol name.
 * @param {string} props.symText - Symbol text.
 * @param {table} props.table - The Tanstack table element.
 */
function Table({ selectedTable, symText, table }) {
    return (
        <>
            <div className="table-header-info">
                <div className="symbol-tooltip-container">
                    <span className="symbol-span"><strong>{selectedTable}</strong></span>
                    {symText && (
                        <div className="symbol-tooltip">
                            <div>{symText}</div>
                        </div>
                    )}
                </div>
                <ColumnToggle table={table} />
            </div>
            <div className="table-container">
                <table>
                    <thead>
                        {table.getHeaderGroups().map(headerGroup => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map(header => (
                                    <th key={header.id}>
                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {table.getRowModel().rows.map(row => (
                            <tr key={row.id}>
                                {row.getVisibleCells().map(cell => (
                                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    )

};

export default Table;