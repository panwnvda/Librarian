import { useRef } from 'react';

const interactiveSelector = 'button,input,textarea,select,a,[role="button"],[data-no-drag-scroll="true"]';

export function useDragScroll() {
  const containerRef = useRef(null);
  const dragRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startScrollLeft: 0,
    startScrollTop: 0,
    dragged: false,
  });

  const handlePointerDown = (event) => {
    if (event.button !== 0 || event.target.closest(interactiveSelector)) return;

    const container = containerRef.current;
    if (!container) return;

    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: container.scrollLeft,
      startScrollTop: container.scrollTop,
      dragged: false,
    };

    container.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    const container = containerRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId || !container) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      drag.dragged = true;
    }

    container.scrollLeft = drag.startScrollLeft - deltaX;
    container.scrollTop = drag.startScrollTop - deltaY;
  };

  const finishDrag = (event) => {
    const drag = dragRef.current;
    const container = containerRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;

    container?.releasePointerCapture?.(event.pointerId);
    drag.active = false;
  };

  const handleClickCapture = (event) => {
    if (!dragRef.current.dragged) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current.dragged = false;
  };

  return {
    ref: containerRef,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: finishDrag,
    onPointerCancel: finishDrag,
    onClickCapture: handleClickCapture,
  };
}
