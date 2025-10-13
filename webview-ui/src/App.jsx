import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
} from '@tanstack/react-table';
import Sidebar from './components/Sidebar';
import Pagination from './components/Pagination';
import ColumnToggle from './components/ColumnToggle';
import './App.css';

const vscode = acquireVsCodeApi();

function fetchSymbolData(params) {
    return new Promise((resolve, reject) => {
        const handleResponse = (event) => {
            const message = event.data;
            if (message.command === 'displaySymbolData') {
                window.removeEventListener('message', handleResponse);
                resolve(message);
            }
        };
        window.addEventListener('message', handleResponse);
        vscode.postMessage({ command: 'getSymbol', ...params });
    });
}


function App() {
    const [symbolIndex, setSymbolIndex] = useState({});
    const [categories, setCategories] = useState([]);
    const [expandedCats, setExpandedCats] = useState({});
    const [selectedTable, setSelectedTable] = useState(null);
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 100 });
    const [columnVisibility, setColumnVisibility] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [goToPageValue, setGoToPageValue] = useState(1);
    const [isInitializing, setIsInitializing] = useState(true);

    const queryClient = useQueryClient();

    const { data: tableQueryResult, isLoading, isError, isFetching } = useQuery({
        queryKey: ['symbolData', selectedTable, pagination.pageIndex, pagination.pageSize],
        queryFn: () => fetchSymbolData({
            symbolName: selectedTable,
            page: pagination.pageIndex + 1,
            rows: pagination.pageSize,
        }),
        enabled: !!selectedTable,
        keepPreviousData: true,
        staleTime: Infinity, // data is always fresh until the gdx file changes, then the cache is invalidated.
    });

    // --- VS Code Communication ---
    useEffect(() => {
        const handleMessage = (event) => {
            const message = event.data;
            switch (message.command) {
                case 'initialize':
                    setSymbolIndex(message.data || {});
                    setCategories(Object.keys(message.data || {}));
                    setSelectedTable(null);
                    setExpandedCats({});
                    setIsInitializing(false);
                    break;
                case 'fileUpdated':
                    queryClient.invalidateQueries();
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        vscode.postMessage({ command: 'initialize' });
        return () => window.removeEventListener('message', handleMessage);
    }, [queryClient]);

    useEffect(() => {
        setGoToPageValue(pagination.pageIndex + 1);
    }, [pagination.pageIndex]);

    const filteredSymbolIndex = useMemo(() => {
        if (!searchTerm) return symbolIndex;
        const newExpandedCats = {};
        const filtered = {};
        const lowerCaseSearchTerm = searchTerm.toLowerCase();

        for (const cat of categories) {
            const matchingSymbols = (symbolIndex[cat] || []).filter(tname =>
                tname.toLowerCase().includes(lowerCaseSearchTerm)
            );
            if (matchingSymbols.length > 0) {
                filtered[cat] = matchingSymbols;
                newExpandedCats[cat] = true;
            }
        }
        setExpandedCats(newExpandedCats);
        return filtered;
    }, [searchTerm, symbolIndex, categories]);
    const categoriesToRender = searchTerm ? Object.keys(filteredSymbolIndex) : categories;

    // --- Event Handlers ---
    const handleSelectTable = (tableName, category) => {
        setExpandedCats({ [category]: true });
        setPagination(p => ({ ...p, pageIndex: 0 }));
        setSelectedTable(tableName);
        setColumnVisibility({});
    };

    const handleToggleCategory = (cat) => {
        setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
    };

    const handleGoToPage = () => {
        const page = parseInt(goToPageValue, 10);
        if (!isNaN(page) && page >= 1 && page <= table.getPageCount()) {
            table.setPageIndex(page - 1);
        }
    };

    const handlePageSizeChange = (newPageSize) => {
        setPagination(p => ({ ...p, pageIndex: 0, pageSize: newPageSize }));
    };

    const tableData = useMemo(() => tableQueryResult?.data || [], [tableQueryResult]);
    const totalRecords = tableQueryResult?.totalRecords || 0;
    const symText = tableQueryResult?.symText;

    const columns = useMemo(() => {
        if (tableData.length === 0) return [];
        const keys = Object.keys(tableData[0]);
        return keys.map(key => ({ accessorKey: key, header: key, cell: info => info.getValue() }));
    }, [tableData]);

    const table = useReactTable({
        data: tableData,
        columns,
        state: { pagination, columnVisibility },
        onPaginationChange: setPagination,
        onColumnVisibilityChange: setColumnVisibility,
        pageCount: Math.ceil(totalRecords / pagination.pageSize) || -1,
        manualPagination: true,
        getCoreRowModel: getCoreRowModel(),
    });

    const showTable = !isLoading && !isError && selectedTable && tableData.length > 0;

    if (isInitializing) {
        return (
            <div className="loader-container">
                <div className="loader"></div>
                <p>Loading Symbols...</p>
            </div>
        );
    }

    return (
        <div className="app-layout">
            <Sidebar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                categoriesToRender={categoriesToRender}
                expandedCats={expandedCats}
                onToggleCategory={handleToggleCategory}
                filteredSymbolIndex={filteredSymbolIndex}
                selectedTable={selectedTable}
                onSelectTable={handleSelectTable}
            />
            <div className="container">
                {!selectedTable ? (
                    <div className="nodata">Select a symbol to view its data.</div>
                ) : isLoading ? (
                    <div className="table-loader-container">
                        <div className="loader"></div>
                        <p>Loading Data...</p>
                    </div>
                ) : isError ? (
                    <div className="nodata">Error fetching data.</div>
                ) : showTable ? (
                    <>
                        <div className="table-header-info">
                            <div className="symbol-tooltip-container">
                                <span className="symbol-span"><strong>{selectedTable}</strong></span>
                                {(symText) && (
                                    <div className="symbol-tooltip">
                                        {symText && <div>{symText}</div>}
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
                                                <td key={cell.id}>
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Pagination
                            table={table}
                            totalRecords={totalRecords}
                            goToPageValue={goToPageValue}
                            onGoToPageValueChange={setGoToPageValue}
                            onGoToPage={handleGoToPage}
                            onPageSizeChange={handlePageSizeChange}
                        />
                    </>
                ) : (
                    <div className="nodata">No data available for <strong>{selectedTable}</strong>.</div>
                )}
            </div>
        </div>
    );
}

export default App;