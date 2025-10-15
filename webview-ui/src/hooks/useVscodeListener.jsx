import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { vscode } from '../utils/vscodeApi';
import { useAppStore } from '../store/store';

export function useVscodeListener() {
    const queryClient = useQueryClient();
    const { initialize, fileUpdated } = useAppStore();

    useEffect(() => {
        const handleMessage = (event) => {
            const message = event.data;
            switch (message.command) {
                case 'initialize':
                    initialize(message.data);
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