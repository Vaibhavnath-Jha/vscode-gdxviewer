import { useEffect } from 'react';
import { useAppStore } from '../store/store';

export function useResizableSidebar(sidebarRef) {

    const { isResizing, setSidebarWidth, stopResizing } = useAppStore();

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing || !sidebarRef.current) return;
            const newWidth = e.clientX - sidebarRef.current.getBoundingClientRect().left;
            if (newWidth >= 200 && newWidth <= 500) {
                setSidebarWidth(newWidth);
            }
        };
        const handleMouseUp = () => stopResizing();

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, setSidebarWidth, stopResizing, sidebarRef]);
}