import { create } from 'zustand';

export const useAppStore = create((set) => ({
    // --- states ---
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

    // --- actions ---
    initialize: (data) => set({
        symbolIndex: data || {},
        categories: Object.keys(data || {}),
        isInitializing: false,
        selectedTable: null,
        expandedCats: {},
        isResizing: false
    }),
    fileUpdated: () => set({ isInitializing: true }),
    selectTable: (tableName, category) => set((state) => ({
        selectedTable: tableName,
        expandedCats: { [category]: true },
        pagination: { ...state.pagination, pageIndex: 0 },
        columnVisibility: {},
        goToPageValue: 1
    })),
    toggleCategory: (cat) => set((state) => ({
        expandedCats: { ...state.expandedCats, [cat]: !state.expandedCats[cat] }
    })),
    setPagination: (updater) => set((state) => ({
        pagination: typeof updater === 'function' ? updater(state.pagination) : updater
    })),
    setColumnVisibility: (updater) => set((state) => ({
        columnVisibility: typeof updater === 'function' ? updater(state.columnVisibility) : updater
    })),
    setSearchTerm: (term) => set({ searchTerm: term }),
    setGoToPageValue: (value) => set({ goToPageValue: value }),
    setExpandedCats: (cats) => set({ expandedCats: cats }),
    setSidebarWidth: (width) => set({ sidebarWidth: width }),
    startResizing: () => set({ isResizing: true }),
    stopResizing: () => set({ isResizing: false })
}));