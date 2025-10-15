import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { vscode } from '../utils/vscodeApi';
import { useAppStore } from '../store/store';

export function useVscodeListener() {
    const queryClient = useQueryClient();
    const { initialize, fileUpdated, selectSymbol } = useAppStore();

    useEffect(() => {
        const handleMessage = (event) => {
            const message = event.data;
            switch (message.command) {
                case 'initialize':
                    const data = message.data || {};
                    const lastSelectedSymbol = message.lastSelectedSymbol;
                    initialize(data);
                    if (lastSelectedSymbol) {
                        for (const cat in data) {
                            if (data[cat].includes(lastSelectedSymbol)) {
                                selectSymbol(lastSelectedSymbol, cat);
                                break;
                            }
                        }
                    }
                    break;
                case 'fileUpdated':
                    fileUpdated();
                    queryClient.invalidateQueries();
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        vscode.postMessage({ command: 'initialize' });

        return () => window.removeEventListener('message', handleMessage);
    }, [queryClient, initialize, fileUpdated]);
}