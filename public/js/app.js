/* Live clock + kiosk idle timer */
setInterval(()=>{
  const now=new Date(), clockFormat=new Intl.DateTimeFormat(loc(),{hour:"2-digit",minute:"2-digit",second:"2-digit"}), clockParts=clockFormat.formatToParts(now), clockPart=type=>clockParts.find(part=>part.type===type)?.value||"";
  document.querySelectorAll('[data-live="clock-main"]').forEach(el=>el.textContent=`${clockPart("hour")}:${clockPart("minute")}`);
  document.querySelectorAll('[data-live="clock-seconds"]').forEach(el=>el.textContent=clockPart("second"));
  document.querySelectorAll('[data-live="clock-period"]').forEach(el=>el.textContent=clockPart("dayPeriod"));
  document.querySelectorAll('.kiosk-clock').forEach(el=>{el.dateTime=now.toISOString();el.setAttribute("aria-label",clockFormat.format(now));});
  if(S.view==="punch"){ const d=buildDay(S.persona,todayStr()); const el=document.querySelector('[data-live="today"]'); if(el) el.textContent=fmtH(d.daily)+" h"; }
  if(S.view==="kiosk"&&UI.kiosk.panel!=="home"){
    const K=UI.kiosk; K.idle=Math.max(0,K.idle-1);
    document.querySelectorAll('[data-live="kidle"]').forEach(el=>el.textContent=K.idle);
    const scanTimer=document.querySelector(".kiosk-scan-countdown"); if(scanTimer) scanTimer.setAttribute("aria-label",`${t("scanTimeout")}: ${K.idle} seconds`);
    if(K.idle===0){ const wasResult=K.panel==="done"; kioskReset(); render(); if(!wasResult) toast("Session timed out. The kiosk is ready for the next person."); }
  }
},1000);

initAppRouter();
render();
