import React, { useState, useEffect, useMemo } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
} from '@tanstack/react-table';
import Sidebar from './components/Sidebar';
import Pagination from './components/Pagination';
import './App.css';

const vscode = acquireVsCodeApi();

function App() {
    // --- State Management ---
    const [symbolIndex, setSymbolIndex] = useState({});
    const [categories, setCategories] = useState([]);
    const [expandedCats, setExpandedCats] = useState({});
    const [selectedTable, setSelectedTable] = useState(null);
    const [tableData, setTableData] = useState([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState('Initializing...');
    const [symbolDataCache, setSymbolDataCache] = useState({});
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 100,
    });
    const [goToPageValue, setGoToPageValue] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');

    // --- VS Code Communication ---
    useEffect(() => {
        const handleMessage = (event) => {
            const message = event.data;
            switch (message.command) {
                case 'initialize':
                    setSymbolIndex(message.data || {});
                    setCategories(Object.keys(message.data || {}));
                    setIsLoading(false);
                    setStatusMessage('Select a symbol or use the search bar.');
                    break;
                case 'displaySymbolData':
                    const receivedData = message.data || [];
                    setTableData(receivedData);
                    setTotalRecords(message.totalRecords || 0);
                    if (receivedData.length === 0) setStatusMessage("No data available for this symbol");
                    if (selectedTable) {
                        setSymbolDataCache(prevCache => ({
                            ...prevCache,
                            [selectedTable]: {
                                ...prevCache[selectedTable],
                                [pagination.pageIndex + 1]: message.data,
                                totalRecords: message.totalRecords,
                            }
                        }));
                    }
                    setIsLoading(false);
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        vscode.postMessage({ command: 'initialize' });
        return () => window.removeEventListener('message', handleMessage);
    }, [selectedTable, pagination.pageIndex]);

    useEffect(() => {
        if (!selectedTable) return;
        const cache = symbolDataCache[selectedTable];
        if (cache && cache[pagination.pageIndex + 1]) {
            setTableData(cache[pagination.pageIndex + 1]);
            setTotalRecords(cache.totalRecords);
            setIsLoading(false);
            return; // Data found in cache, no need to fetch
        }
        setIsLoading(true);
        setStatusMessage('Loading data...');
        vscode.postMessage({
            command: 'getSymbol',
            symbolName: selectedTable,
            page: pagination.pageIndex + 1,
        });
    }, [selectedTable, pagination, symbolDataCache]);

    useEffect(() => {
        setGoToPageValue(pagination.pageIndex + 1);
    }, [pagination.pageIndex]);

    // --- Live Search Filtering Logic ---
    const filteredSymbolIndex = useMemo(() => {
        if (!searchTerm) {
            return symbolIndex;
        }
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

    const handleSelectTable = (tableName, category) => {
        setExpandedCats({ [category]: true });
        setPagination(p => ({ ...p, pageIndex: 0 }));
        setSelectedTable(tableName);
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

    // --- TanStack Table Setup ---
    const columns = useMemo(() => {
        if (tableData.length === 0) return [];
        const keys = Object.keys(tableData[0]);
        return keys.map(key => ({
            accessorKey: key,
            header: () => <span>{key}</span>,
            cell: info => info.getValue(),
        }));
    }, [tableData]);

    const table = useReactTable({
        data: tableData,
        columns,
        state: { pagination },
        onPaginationChange: setPagination,
        pageCount: Math.ceil(totalRecords / pagination.pageSize) || -1,
        manualPagination: true,
        getCoreRowModel: getCoreRowModel(),
    });

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
                {isLoading || tableData.length === 0 && selectedTable ? (
                    <div className="nodata">{statusMessage}</div>
                ) : (
                    <>
                        <div className="table-container">
                            <div className="table-header-info">
                                <span className="symbol-span"><strong>{selectedTable}</strong></span>
                            </div>
                            <table>
                                <thead>
                                    {table.getHeaderGroups().map(headerGroup => (
                                        <tr key={headerGroup.id}>
                                            {headerGroup.headers.map(header => <th key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</th>)}
                                        </tr>
                                    ))}
                                </thead>
                                <tbody>
                                    {table.getRowModel().rows.map(row => (
                                        <tr key={row.id}>
                                            {row.getVisibleCells().map(cell => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
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
                        />
                    </>
                )}
            </div>
        </div>
    );
}

export default App;