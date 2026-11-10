"use strict";
/* p194: touch polish for phones (November 9, 2026, from a gesture audit after a tester found the two finger
   measure fighting pinch to zoom). On touch screens:
   1. The handles for Edit route (16 px waypoints, 12 px add point dots) and the measure points were too small
      to grab, so a near miss panned the map instead. Each now has an invisible grab area about a fingertip
      wide. The visible dot is unchanged.
   2. While a handle is being dragged the page behind does not scroll or bounce.
   3. The small Show and Hide buttons on brief panels and the small link buttons were about 21 px tall; they
      keep their look and get a taller invisible tap area.
   Mouse and trackpad users see no change. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    @media (pointer:coarse){
      .re-h,.re-g,.ms-pt{position:relative}
      .re-h::before,.ms-pt::before{content:"";position:absolute;left:50%;top:50%;width:44px;height:44px;transform:translate(-50%,-50%);border-radius:50%}
      .re-g::before{content:"";position:absolute;left:50%;top:50%;width:32px;height:32px;transform:translate(-50%,-50%);border-radius:50%}
      .leaflet-marker-icon:has(.re-h){z-index:1000!important}
      .pnl-tg,.linkbtn{position:relative}
      .pnl-tg::before,.linkbtn::before{content:"";position:absolute;left:-8px;right:-8px;top:50%;height:44px;transform:translateY(-50%)}
      .leaflet-marker-icon:has(.re-h),.leaflet-marker-icon:has(.re-g),.leaflet-marker-icon:has(.ms-pt){touch-action:none}
    }`;
  document.head.appendChild(css);
})();
