import { useEffect } from 'react';

export function useResizableSidebar(isResizing, dispatch) {
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing) return;
            const newWidth = e.clientX;
            if (newWidth >= 200 && newWidth <= 500) {
                dispatch({ type: 'SET_SIDEBAR_WIDTH', payload: newWidth });
            }
        };
        const handleMouseUp = () => dispatch({ type: 'SET_IS_RESIZING', payload: false });

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, dispatch]);
}

