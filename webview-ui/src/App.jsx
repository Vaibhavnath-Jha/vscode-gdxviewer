import React, { useEffect, useMemo, useReducer, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
} from '@tanstack/react-table';

import { vscode } from './vscodeApi';
import Sidebar from './components/Sidebar';
import Pagination from './components/Pagination';
import ColumnToggle from './components/ColumnToggle';
import { useVscodeListener } from './hooks/useVscodeListener';
import { useResizableSidebar } from './hooks/useResizableSidebar';
import './App.css';

// --- Helper Functions & Loader Components ---
function fetchSymbolData(params) {
    return new Promise((resolve) => {
        const handleResponse = (event) => {
            if (event.data.command === 'displaySymbolData') {
                window.removeEventListener('message', handleResponse);
                resolve(event.data);
            }
        };
        window.addEventListener('message', handleResponse);
        vscode.postMessage({ command: 'getSymbol', ...params });
    });
}

function InitialLoader() {
    return (
        <div className="loader-container">
            <div className="loader"></div>
            <p>Loading Symbols...</p>
        </div>
    );
}
function TableLoader() {
    return (
        <div className="table-loader-container">
            <div className="loader"></div>
            <p>Loading Data...</p>
        </div>
    );
}

// --- Reducer for State Management ---
const initialState = {
    isInitializing: true,
    symbolIndex: {},
    categories: [],
    expandedCats: {},
    selectedTable: null,
    pagination: { pageIndex: 0, pageSize: 100 },
    columnVisibility: {},
    searchTerm: '',
    goToPageValue: 1,
    sidebarWidth: 240,
    isResizing: false,
};

function reducer(state, action) {
    switch (action.type) {
        case 'INITIALIZE':
            return {
                ...state,
                symbolIndex: action.payload.data || {},
                categories: Object.keys(action.payload.data || {}),
                isInitializing: false,
            };
        case 'FILE_UPDATED':
            return { ...state, isInitializing: true };
        case 'SELECT_TABLE':
            return {
                ...state,
                selectedTable: action.payload.tableName,
                expandedCats: { [action.payload.category]: true },
                pagination: { ...state.pagination, pageIndex: 0 },
                columnVisibility: {},
            };
        case 'TOGGLE_CATEGORY':
            return { ...state, expandedCats: { ...state.expandedCats, [action.payload]: !state.expandedCats[action.payload] } };
        case 'SET_PAGINATION':
            return { ...state, pagination: action.payload };
        case 'SET_COLUMN_VISIBILITY':
            return { ...state, columnVisibility: action.payload };
        case 'SET_SEARCH_TERM':
            return { ...state, searchTerm: action.payload };
        case 'SET_GOTO_PAGE_VALUE':
            return { ...state, goToPageValue: action.payload };
        case 'SET_EXPANDED_CATS':
            return { ...state, expandedCats: action.payload };
        case 'SET_SIDEBAR_WIDTH':
            return { ...state, sidebarWidth: action.payload };
        case 'SET_IS_RESIZING':
            return { ...state, isResizing: action.payload };
        default:
            return state;
    }
}

function App() {
    const [state, dispatch] = useReducer(reducer, initialState);
    const {
        isInitializing, symbolIndex, categories, expandedCats, selectedTable, pagination,
        columnVisibility, searchTerm, goToPageValue, sidebarWidth, isResizing
    } = state;

    const sidebarRef = useRef(null);

    // --- Using Custom Hooks for side effects ---
    useVscodeListener(dispatch);
    useResizableSidebar(isResizing, dispatch);

    const { data: tableQueryResult, isLoading, isError } = useQuery({
        queryKey: ['symbolData', selectedTable, pagination.pageIndex, pagination.pageSize],
        queryFn: () => fetchSymbolData({
            symbolName: selectedTable,
            page: pagination.pageIndex + 1,
            rows: pagination.pageSize,
        }),
        enabled: !!selectedTable,
        keepPreviousData: true,
        staleTime: Infinity,
    });

    useEffect(() => {
        dispatch({ type: 'SET_GOTO_PAGE_VALUE', payload: pagination.pageIndex + 1 });
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
        dispatch({ type: 'SET_EXPANDED_CATS', payload: newExpandedCats });
        return filtered;
    }, [searchTerm, symbolIndex, categories]);

    const categoriesToRender = searchTerm ? Object.keys(filteredSymbolIndex) : categories;

    const tableData = useMemo(() => tableQueryResult?.data || [], [tableQueryResult]);
    const totalRecords = tableQueryResult?.totalRecords || 0;
    const symText = tableQueryResult?.symText || '';
    const columns = useMemo(() => {
        if (tableData.length === 0) return [];
        return Object.keys(tableData[0]).map(key => ({
            accessorKey: key,
            header: key,
            cell: info => info.getValue(),
        }));
    }, [tableData]);

    const table = useReactTable({
        data: tableData,
        columns,
        state: { pagination, columnVisibility },
        onPaginationChange: (updater) => dispatch({ type: 'SET_PAGINATION', payload: typeof updater === 'function' ? updater(pagination) : updater }),
        onColumnVisibilityChange: (updater) => dispatch({ type: 'SET_COLUMN_VISIBILITY', payload: typeof updater === 'function' ? updater(columnVisibility) : updater }),
        pageCount: Math.ceil(totalRecords / pagination.pageSize) || -1,
        manualPagination: true,
        getCoreRowModel: getCoreRowModel(),
    });

    if (isInitializing) {
        return <InitialLoader />;
    }

    return (
        <div className="app-layout">
            <Sidebar
                ref={sidebarRef}
                style={{ width: `${sidebarWidth}px` }}
                searchTerm={searchTerm}
                onSearchChange={(value) => dispatch({ type: 'SET_SEARCH_TERM', payload: value })}
                categoriesToRender={categoriesToRender}
                expandedCats={expandedCats}
                onToggleCategory={(cat) => dispatch({ type: 'TOGGLE_CATEGORY', payload: cat })}
                filteredSymbolIndex={filteredSymbolIndex}
                selectedTable={selectedTable}
                onSelectTable={(tableName, category) => dispatch({ type: 'SELECT_TABLE', payload: { tableName, category } })}
            >
                <div
                    className="resizer"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        dispatch({ type: 'SET_IS_RESIZING', payload: true });
                    }}
                ></div>
            </Sidebar>
            <div className="container">
                {!selectedTable ? (
                    <div className="nodata">Select a symbol to view its data.</div>
                ) : isLoading ? (
                    <TableLoader />
                ) : isError ? (
                    <div className="nodata">Error fetching data.</div>
                ) : tableData.length > 0 ? (
                    <>
                        <div className="table-header-info">
                            <div className="symbol-tooltip-container">
                                <span className="symbol-span"><strong>{selectedTable}</strong></span>
                                {(symText) && (
                                    <div className="symbol-tooltip">
                                        {<div>{symText}</div>}
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
                        <Pagination
                            table={table}
                            totalRecords={totalRecords}
                            goToPageValue={goToPageValue}
                            onGoToPageValueChange={(value) => dispatch({ type: 'SET_GOTO_PAGE_VALUE', payload: value })}
                            onGoToPage={() => {
                                const page = parseInt(goToPageValue, 10);
                                if (!isNaN(page) && page >= 1 && page <= table.getPageCount()) {
                                    table.setPageIndex(page - 1);
                                }
                            }}
                            onPageSizeChange={(size) => dispatch({ type: 'SET_PAGINATION', payload: { pageIndex: 0, pageSize: size } })}
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