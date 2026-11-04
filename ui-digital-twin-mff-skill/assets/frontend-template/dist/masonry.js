export function masonryPlacements(heights,columns,unit=8,gap=20){
 const ends=Array.from({length:Math.max(1,columns)},()=>1);
 return heights.map(height=>{
  const column=ends.indexOf(Math.min(...ends)),start=ends[column],span=Math.max(1,Math.ceil((height+gap)/unit));
  ends[column]+=span;return {column:column+1,start,span};
 });
}
export function mountMasonry(container){
 let queued=false;
 const layout=()=>{
  queued=false;if(!container.clientWidth||container.hidden)return;
  const columns=Number(getComputedStyle(container).getPropertyValue('--alarm-columns'))||2;
  const cards=[...container.querySelectorAll('.center-event:not([hidden])')];
  const placements=masonryPlacements(cards.map(card=>card.getBoundingClientRect().height),columns);
  cards.forEach((card,i)=>{const p=placements[i],row=p.start+' / span '+p.span;
   if(card.style.gridColumn!==String(p.column))card.style.gridColumn=String(p.column);
   if(card.style.gridRow!==row)card.style.gridRow=row;
  });
 };
 const schedule=()=>{if(!queued){queued=true;requestAnimationFrame(layout);}};
 const observer=new ResizeObserver(schedule);observer.observe(container);
 return {observe:card=>observer.observe(card),forget:card=>observer.unobserve(card),schedule};
}
