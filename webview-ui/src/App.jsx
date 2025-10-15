import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    useReactTable,
    getCoreRowModel
} from '@tanstack/react-table';

import { useAppStore } from './store/store';
import { vscode } from './utils/vscodeApi';
import Sidebar from './components/Sidebar';
import Table from './components/Table';
import Pagination from './components/Pagination';
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

function App() {
    const sidebarRef = useRef(null);

    // --- Custom Hooks ---
    useVscodeListener();
    useResizableSidebar(sidebarRef);

    const sidebarWidth = useAppStore((state) => state.sidebarWidth);
    const startResizing = useAppStore((state) => state.startResizing);

    // --- Import states from Appstore ---
    const {
        isInitializing, symbolIndex, categories, expandedCats, selectedSymbol, pagination,
        columnVisibility, searchTerm, goToPageValue
    } = useAppStore();

    // --- Import actions from Appstore ---
    const {
        setPagination, setColumnVisibility, setSearchTerm, setGoToPageValue,
        selectSymbol, toggleCategory, setExpandedCats
    } = useAppStore();

    // --- Tantstack-query ---
    const { data: tableQueryResult, isLoading, isError } = useQuery({
        queryKey: ['symbolData', selectedSymbol, pagination.pageIndex, pagination.pageSize],
        queryFn: () => fetchSymbolData({
            symbolName: selectedSymbol,
            page: pagination.pageIndex + 1,
            rows: pagination.pageSize,
        }),
        enabled: !!selectedSymbol,
        keepPreviousData: true,
        staleTime: Infinity,
    });

    const handleGoToPage = () => {
        const page = parseInt(goToPageValue, 10);
        if (!isNaN(page) && page >= 1 && page <= table.getPageCount()) {
            table.setPageIndex(page - 1);
        }
    };

    useEffect(() => {
        setGoToPageValue(pagination.pageIndex + 1);
    }, [pagination.pageIndex, setGoToPageValue]);

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
    }, [searchTerm, symbolIndex, categories, setExpandedCats]);

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
        onPaginationChange: setPagination,
        onColumnVisibilityChange: setColumnVisibility,
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
                onSearchChange={setSearchTerm}
                categoriesToRender={categoriesToRender}
                expandedCats={expandedCats}
                onToggleCategory={toggleCategory}
                filteredSymbolIndex={filteredSymbolIndex}
                selectedSymbol={selectedSymbol}
                onSelectSymbol={selectSymbol}
            >
                <div
                    className="resizer"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        startResizing();
                    }}
                ></div>
            </Sidebar>
            <div className="container">
                {!selectedSymbol ? (
                    <div className="nodata">Select a symbol to view its data.</div>
                ) : isLoading ? (
                    <TableLoader />
                ) : isError ? (
                    <div className="nodata">Error fetching data.</div>
                ) : tableData.length > 0 ? (
                    <>
                        <Table
                            selectedSymbol={selectedSymbol}
                            symText={symText}
                            table={table}
                        />
                        <Pagination
                            table={table}
                            totalRecords={totalRecords}
                            goToPageValue={goToPageValue}
                            onGoToPageValueChange={setGoToPageValue}
                            onGoToPage={handleGoToPage}
                            onPageSizeChange={(size) => setPagination(p => ({ ...p, pageIndex: 0, pageSize: size }))}
                        />
                    </>
                ) : (
                    <div className="nodata">No data available for <strong>{selectedSymbol}</strong>.</div>
                )}
            </div>
        </div>
    );
}

export default App;