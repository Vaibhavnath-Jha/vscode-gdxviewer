import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { vscode } from '../vscodeApi';


export function useVscodeListener(dispatch) {
    const queryClient = useQueryClient();

    useEffect(() => {
        const handleMessage = (event) => {
            const message = event.data;
            switch (message.command) {
                case 'initialize':
                    dispatch({ type: 'INITIALIZE', payload: { data: message.data } });
                    break;
                case 'fileUpdated':
                    dispatch({ type: 'FILE_UPDATED' });
                    queryClient.invalidateQueries();
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        vscode.postMessage({ command: 'initialize' });

        return () => window.removeEventListener('message', handleMessage);
    }, [queryClient, dispatch]);
}

