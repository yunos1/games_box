export function createSwipeHandlers(onSwipe) {
  let startX = 0;
  let startY = 0;

  function onTouchStart(event) {
    const touch = event.changedTouches[0];
    startX = touch.clientX;
    startY = touch.clientY;
  }

  function onTouchEnd(event) {
    const touch = event.changedTouches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (Math.max(absX, absY) < 24) return;
    if (absX > absY) {
      onSwipe(dx > 0 ? "right" : "left");
    } else {
      onSwipe(dy > 0 ? "down" : "up");
    }
  }

  return { onTouchStart, onTouchEnd };
}
